<?php

namespace App\Console\Commands;

use App\Models\DetectionLog;
use App\Models\Device;
use App\Models\Rack;
use App\Models\Room;
use App\Models\SystemSetting;
use GuzzleHttp\Client;
use Illuminate\Console\Command;

class AutoDetectDevices extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'devices:auto-detect {--type=auto : 检测类型(auto/manual)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '自动检测设备在线状态';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $startTime = microtime(true);
        $type = $this->option('type');

        // 检查自动检测是否启用(仅自动检测时需要检查)
        if ($type === 'auto') {
            $enabled = SystemSetting::get('auto_detection_enabled', true);
            if (! $enabled) {
                $this->info('自动检测已关闭，跳过检测');

                return self::SUCCESS;
            }

            // 检查是否到达检测间隔
            $interval = SystemSetting::get('auto_detection_interval', 5);
            $lastAutoDetection = DetectionLog::getLastAutoRun();

            if ($lastAutoDetection) {
                $minutesSinceLastDetection = now()->diffInMinutes($lastAutoDetection->created_at);

                if ($minutesSinceLastDetection < $interval) {
                    $remainingMinutes = $interval - $minutesSinceLastDetection;
                    $this->info("距离上次检测仅 {$minutesSinceLastDetection} 分钟，还需等待 {$remainingMinutes} 分钟");

                    return self::SUCCESS;
                }
            }

            $this->info("检测间隔已满足（{$interval} 分钟），准备执行检测");

            $this->info("自动检测已启用，检测间隔: {$interval} 分钟");
        }

        $this->info("开始设备状态检测... [{$type}]");

        // 创建检测记录
        $log = DetectionLog::create([
            'type' => $type,
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            // 执行检测
            $results = $this->detectDevices();

            // 获取机房温湿度
            $roomTempHumidityResults = $this->fetchRoomTempHumidity();

            // 获取机柜温湿度
            $rackTempHumidityResults = $this->fetchRackTempHumidity();

            $duration = round((microtime(true) - $startTime) * 1000);

            // 更新日志
            $log->update([
                'total_devices' => $results['total'],
                'online_count' => $results['online'],
                'offline_count' => $results['offline'],
                'maintenance_count' => $results['maintenance'],
                'updated_count' => $results['updated'],
                'duration_ms' => $duration,
                'details' => $results['details'],
                'status' => 'success',
                'message' => "检测完成，{$results['updated']} 台设备状态已更新，{$roomTempHumidityResults['updated']} 个机房温湿度已更新，{$rackTempHumidityResults['updated']} 个机柜温湿度已更新",
                'completed_at' => now(),
            ]);

            $this->info("检测完成！耗时 {$duration}ms");
            $this->info("总计: {$results['total']}, 在线: {$results['online']}, 离线: {$results['offline']}, 维护中: {$results['maintenance']}");
            $this->info("状态更新: {$results['updated']} 台设备");
            $this->info("机房温湿度更新: {$roomTempHumidityResults['updated']} 个");
            $this->info("机柜温湿度更新: {$rackTempHumidityResults['updated']} 个");

            return self::SUCCESS;
        } catch (\Exception $e) {
            $duration = round((microtime(true) - $startTime) * 1000);

            $log->update([
                'duration_ms' => $duration,
                'status' => 'failed',
                'message' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            $this->error("检测失败: {$e->getMessage()}");

            return self::FAILURE;
        }
    }

    /**
     * 执行设备检测
     */
    private function detectDevices(): array
    {
        $results = [];
        $updatedCount = 0;
        $onlineCount = 0;
        $offlineCount = 0;
        $maintenanceCount = 0;

        // 获取所有有IP的设备
        $devices = Device::query()
            ->whereNotNull('ip_address')
            ->where('ip_address', '!=', '')
            ->get();

        foreach ($devices as $device) {
            $ip = $device->ip_address;
            $isOnline = $this->ping($ip);

            $oldStatus = $device->status;
            $newStatus = $isOnline ? 'online' : 'offline';

            // 更新设备状态
            if ($oldStatus !== $newStatus) {
                $device->status = $newStatus;
                $device->save();
                $updatedCount++;
            }

            // 统计
            if ($newStatus === 'online') {
                $onlineCount++;
            } else {
                $offlineCount++;
            }

            $results[] = [
                'id' => $device->id,
                'name' => $device->name,
                'ip' => $ip,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'changed' => $oldStatus !== $newStatus,
            ];
        }

        // 处理没有IP的设备
        $noIpDevices = Device::query()
            ->where(function ($q) {
                $q->whereNull('ip_address')
                    ->orWhere('ip_address', '');
            })
            ->get();

        foreach ($noIpDevices as $device) {
            $oldStatus = $device->status;
            if ($oldStatus !== 'maintenance') {
                $device->status = 'maintenance';
                $device->save();
                $updatedCount++;
            }
            $maintenanceCount++;

            $results[] = [
                'id' => $device->id,
                'name' => $device->name,
                'ip' => null,
                'old_status' => $oldStatus,
                'new_status' => 'maintenance',
                'changed' => $oldStatus !== 'maintenance',
            ];
        }

        return [
            'total' => count($results),
            'online' => $onlineCount,
            'offline' => $offlineCount,
            'maintenance' => $maintenanceCount,
            'updated' => $updatedCount,
            'details' => $results,
        ];
    }

    /**
     * 执行 Ping 命令
     */
    private function ping(string $ip): bool
    {
        // 验证 IP 地址格式
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        $timeout = 2; // 2秒超时
        $count = 1;   // 发送1个包

        // 根据操作系统选择命令
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            // Windows
            $command = sprintf('ping -n %d -w %d %s', $count, $timeout * 1000, escapeshellarg($ip));
        } else {
            // Linux/Mac
            $command = sprintf('ping -c %d -W %d %s 2>/dev/null', $count, $timeout, escapeshellarg($ip));
        }

        exec($command, $output, $returnCode);

        return $returnCode === 0;
    }

    /**
     * 获取所有配置了温湿度URL的机房的温湿度数据
     */
    private function fetchRoomTempHumidity(): array
    {
        $updatedCount = 0;
        $totalCount = 0;

        $rooms = Room::query()
            ->whereNotNull('temp_humidity_url')
            ->where('temp_humidity_url', '!=', '')
            ->get();

        foreach ($rooms as $room) {
            $totalCount++;
            try {
                $data = $this->fetchTempHumidityFromUrl($room->temp_humidity_url);

                if ($data !== null) {
                    $room->update([
                        'current_temp' => $data['temp'],
                        'current_humidity' => $data['humidity'],
                        'temp_humidity_updated_at' => now(),
                    ]);
                    $updatedCount++;
                    $this->info("机房 {$room->name} 温湿度更新: {$data['temp']}°C, {$data['humidity']}%");
                }
            } catch (\Exception $e) {
                $this->warning("机房 {$room->name} 温湿度获取失败: {$e->getMessage()}");
            }
        }

        return [
            'total' => $totalCount,
            'updated' => $updatedCount,
        ];
    }

    /**
     * 获取所有配置了温湿度URL的机柜的温湿度数据
     */
    private function fetchRackTempHumidity(): array
    {
        $updatedCount = 0;
        $totalCount = 0;

        $racks = Rack::query()
            ->whereNotNull('temp_humidity_url')
            ->where('temp_humidity_url', '!=', '')
            ->get();

        foreach ($racks as $rack) {
            $totalCount++;
            try {
                $data = $this->fetchTempHumidityFromUrl($rack->temp_humidity_url);

                if ($data !== null) {
                    $rack->update([
                        'current_temp' => $data['temp'],
                        'current_humidity' => $data['humidity'],
                        'temp_humidity_updated_at' => now(),
                    ]);
                    $updatedCount++;
                    $this->info("机柜 {$rack->name} 温湿度更新: {$data['temp']}°C, {$data['humidity']}%");
                }
            } catch (\Exception $e) {
                $this->warning("机柜 {$rack->name} 温湿度获取失败: {$e->getMessage()}");
            }
        }

        return [
            'total' => $totalCount,
            'updated' => $updatedCount,
        ];
    }

    /**
     * 从温湿度控制器URL获取数据
     * 预期返回格式: {"Temp.":26,"Hum.":36}
     */
    private function fetchTempHumidityFromUrl(string $url): ?array
    {
        $client = new Client([
            'timeout' => 5,
            'connect_timeout' => 3,
        ]);

        $response = $client->get($url);
        $body = $response->getBody()->getContents();
        $data = json_decode($body, true);

        if (! is_array($data)) {
            return null;
        }

        $temp = null;
        $humidity = null;

        foreach ($data as $key => $value) {
            $lowerKey = strtolower($key);
            if (str_contains($lowerKey, 'temp')) {
                $temp = (float) $value;
            } elseif (str_contains($lowerKey, 'hum')) {
                $humidity = (float) $value;
            }
        }

        if ($temp !== null && $humidity !== null) {
            return [
                'temp' => $temp,
                'humidity' => $humidity,
            ];
        }

        return null;
    }
}
