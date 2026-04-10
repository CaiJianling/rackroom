<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PingController extends Controller
{
    /**
     * 批量 Ping 检测
     */
    public function batchPing(Request $request): JsonResponse
    {
        $request->validate([
            'rack_id' => 'nullable|integer',
        ]);

        $rackId = $request->input('rack_id');

        // 查询需要检测的设备
        $query = Device::query()
            ->with('rack')
            ->whereNotNull('ip_address')
            ->where('ip_address', '!=', '');

        if ($rackId) {
            $query->where('rack_id', $rackId);
        }

        $devices = $query->get();

        $results = [];
        $updatedCount = 0;

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

            $results[] = [
                'id' => $device->id,
                'name' => $device->name,
                'ip' => $ip,
                'status' => $newStatus,
                'is_online' => $isOnline,
                'rack_name' => $device->rack?->name,
            ];
        }

        // 同时处理没有 IP 的设备，设置为维护中
        $noIpQuery = Device::query()
            ->where(function ($q) {
                $q->whereNull('ip_address')
                    ->orWhere('ip_address', '');
            });

        if ($rackId) {
            $noIpQuery->where('rack_id', $rackId);
        }

        $noIpDevices = $noIpQuery->where('status', '!=', 'maintenance')->get();
        foreach ($noIpDevices as $device) {
            $device->status = 'maintenance';
            $device->save();
            $updatedCount++;

            $results[] = [
                'id' => $device->id,
                'name' => $device->name,
                'ip' => null,
                'status' => 'maintenance',
                'is_online' => false,
                'rack_name' => $device->rack?->name,
            ];
        }

        return response()->json([
            'success' => true,
            'message' => "检测完成，{$updatedCount} 台设备状态已更新",
            'results' => $results,
            'total' => count($results),
            'online' => count(array_filter($results, fn ($r) => $r['status'] === 'online')),
            'offline' => count(array_filter($results, fn ($r) => $r['status'] === 'offline')),
            'maintenance' => count(array_filter($results, fn ($r) => $r['status'] === 'maintenance')),
        ]);
    }

    /**
     * 单个 Ping 检测
     */
    public function pingDevice(Device $device): JsonResponse
    {
        if (empty($device->ip_address)) {
            $device->status = 'maintenance';
            $device->save();

            return response()->json([
                'success' => true,
                'status' => 'maintenance',
                'message' => '设备无 IP，已设置为维护中',
            ]);
        }

        $isOnline = $this->ping($device->ip_address);
        $newStatus = $isOnline ? 'online' : 'offline';

        $device->status = $newStatus;
        $device->save();

        return response()->json([
            'success' => true,
            'status' => $newStatus,
            'is_online' => $isOnline,
            'message' => $isOnline ? '设备在线' : '设备离线',
        ]);
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
}
