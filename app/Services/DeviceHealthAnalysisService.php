<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DetectionLog;
use App\Models\Rack;
use App\Models\Room;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class DeviceHealthAnalysisService
{
    public function analyzeDeviceHealth(int $deviceId): array
    {
        $device = Device::with(['rack.room', 'deviceLibrary.deviceType'])->findOrFail($deviceId);

        $onlineRate = $this->calculateOnlineRate($device);
        $stabilityScore = $this->calculateStabilityScore($device);
        $healthScore = $this->calculateOverallHealthScore($onlineRate, $stabilityScore, $device);
        $riskLevel = $this->determineRiskLevel($healthScore, $onlineRate);

        $recentIncidents = $this->getRecentIncidents($device);
        $maintenanceHistory = $this->getMaintenanceHistory($device);
        $powerEfficiency = $this->calculatePowerEfficiency($device);

        return [
            'device_id' => $deviceId,
            'device_name' => $device->name,
            'ip_address' => $device->ip_address,
            'category' => $device->category,
            'rack_name' => $device->rack?->name,
            'room_name' => $device->rack?->room?->name,
            'health_score' => round($healthScore, 1),
            'health_status' => $this->getHealthStatus($healthScore),
            'risk_level' => $riskLevel,
            'online_rate' => round($onlineRate, 2),
            'stability_score' => round($stabilityScore, 1),
            'power_efficiency' => round($powerEfficiency, 2),
            'uptime_days' => $this->calculateUptimeDays($device),
            'recent_incidents' => $recentIncidents,
            'maintenance_recommendation' => $this->getMaintenanceRecommendation($healthScore, $onlineRate, $stabilityScore),
            'details' => [
                'online_rate_analysis' => $this->analyzeOnlineRateTrend($device),
                'power_analysis' => [
                    'current_power' => $device->power ?? 0,
                    'typical_power' => $device->deviceLibrary?->power ?? 0,
                    'is_within_normal_range' => $this->isPowerWithinNormalRange($device),
                ],
            ],
        ];
    }

    private function calculateOnlineRate(Device $device): float
    {
        if (empty($device->ip_address)) {
            return 100.0;
        }

        $recentLogs = DetectionLog::where('type', 'auto')
            ->orderBy('started_at', 'desc')
            ->limit(30)
            ->get();

        if ($recentLogs->isEmpty()) {
            return $device->status === 'online' ? 100.0 : 0.0;
        }

        $totalChecks = $recentLogs->count();
        $onlineChecks = $recentLogs->filter(function ($log) use ($device) {
            $details = is_array($log->details) ? $log->details : [];
            foreach ($details as $detail) {
                if (isset($detail['ip']) && $detail['ip'] === $device->ip_address) {
                    return $detail['is_online'] ?? false;
                }
            }
            return $device->status === 'online';
        })->count();

        return $totalChecks > 0 ? ($onlineChecks / $totalChecks) * 100 : ($device->status === 'online' ? 100.0 : 0.0);
    }

    private function calculateStabilityScore(Device $device): float
    {
        $logs = DetectionLog::where('type', 'auto')
            ->orderBy('started_at', 'desc')
            ->limit(20)
            ->get();

        if ($logs->isEmpty() || empty($device->ip_address)) {
            return 100.0;
        }

        $statusChanges = 0;
        $previousStatus = null;

        $deviceStatuses = [];
        foreach ($logs as $log) {
            $details = is_array($log->details) ? $log->details : [];
            $isOnline = false;
            foreach ($details as $detail) {
                if (isset($detail['ip']) && $detail['ip'] === $device->ip_address) {
                    $isOnline = $detail['is_online'] ?? false;
                    break;
                }
            }
            $deviceStatuses[] = $isOnline ? 'online' : 'offline';
        }

        for ($i = 1; $i < count($deviceStatuses); $i++) {
            if ($deviceStatuses[$i] !== $deviceStatuses[$i - 1]) {
                $statusChanges++;
            }
        }

        $maxExpectedChanges = count($deviceStatuses) - 1;
        if ($maxExpectedChanges <= 0) {
            return 100.0;
        }

        $stabilityScore = max(0, 100 - ($statusChanges * (100 / $maxExpectedChanges)));

        return $stabilityScore;
    }

    private function calculateOverallHealthScore(float $onlineRate, float $stabilityScore, Device $device): float
    {
        $healthScore = ($onlineRate * 0.5) + ($stabilityScore * 0.3);

        if ($device->status === 'maintenance') {
            $healthScore = min($healthScore, 60);
        }

        if ($device->power > 0 && $device->deviceLibrary?->power > 0) {
            $powerRatio = $device->power / $device->deviceLibrary->power;
            if ($powerRatio > 1.2) {
                $healthScore -= 10;
            } elseif ($powerRatio < 0.5) {
                $healthScore -= 5;
            }
        }

        return max(0, min(100, $healthScore));
    }

    private function determineRiskLevel(float $healthScore, float $onlineRate): string
    {
        if ($healthScore >= 80 && $onlineRate >= 95) {
            return 'low';
        } elseif ($healthScore >= 60 && $onlineRate >= 80) {
            return 'medium';
        } elseif ($healthScore >= 40) {
            return 'high';
        }

        return 'critical';
    }

    private function getHealthStatus(float $score): string
    {
        if ($score >= 90) {
            return 'excellent';
        } elseif ($score >= 75) {
            return 'good';
        } elseif ($score >= 60) {
            return 'fair';
        } elseif ($score >= 40) {
            return 'poor';
        }

        return 'critical';
    }

    private function analyzeOnlineRateTrend(Device $device): array
    {
        $trends = [];

        foreach ([7, 14, 30] as $days) {
            $logs = DetectionLog::where('type', 'auto')
                ->where('started_at', '>=', now()->subDays($days))
                ->orderBy('started_at', 'desc')
                ->get();

            if ($logs->isEmpty() || empty($device->ip_address)) {
                $trends["last_{$days}_days"] = [
                    'days' => $days,
                    'online_rate' => $device->status === 'online' ? 100.0 : 0.0,
                    'check_count' => 0,
                ];
                continue;
            }

            $onlineCount = 0;
            foreach ($logs as $log) {
                $details = is_array($log->details) ? $log->details : [];
                foreach ($details as $detail) {
                    if (isset($detail['ip']) && $detail['ip'] === $device->ip_address && ($detail['is_online'] ?? false)) {
                        $onlineCount++;
                        break;
                    }
                }
            }

            $trends["last_{$days}_days"] = [
                'days' => $days,
                'online_rate' => round(($onlineCount / max(1, $logs->count())) * 100, 2),
                'check_count' => $logs->count(),
            ];
        }

        return $trends;
    }

    private function getRecentIncidents(Device $device): array
    {
        $incidents = [];

        $logs = DetectionLog::where('type', 'auto')
            ->where('started_at', '>=', now()->subDays(7))
            ->orderBy('started_at', 'desc')
            ->get();

        $previousStatus = null;
        foreach ($logs as $log) {
            $details = is_array($log->details) ? $log->details : [];
            $isOnline = false;
            foreach ($details as $detail) {
                if (isset($detail['ip']) && $detail['ip'] === $device->ip_address) {
                    $isOnline = $detail['is_online'] ?? false;
                    break;
                }
            }

            $currentStatus = $isOnline ? 'online' : 'offline';

            if ($previousStatus !== null && $currentStatus !== $previousStatus) {
                $incidents[] = [
                    'time' => $log->started_at->toDateTimeString(),
                    'type' => $currentStatus === 'online' ? 'recovery' : 'outage',
                    'previous_status' => $previousStatus,
                    'current_status' => $currentStatus,
                ];
            }

            $previousStatus = $currentStatus;
        }

        return array_slice($incidents, 0, 10);
    }

    private function getMaintenanceHistory(Device $device): array
    {
        return [];
    }

    private function calculatePowerEfficiency(Device $device): float
    {
        if ($device->power <= 0 || $device->deviceLibrary?->power <= 0) {
            return 100.0;
        }

        $ratio = $device->power / $device->deviceLibrary->power;

        if ($ratio >= 0.7 && $ratio <= 1.1) {
            return 100.0;
        } elseif ($ratio >= 0.5 && $ratio <= 1.3) {
            return 85.0;
        } elseif ($ratio > 1.3) {
            return max(50, 100 - (($ratio - 1.3) * 100));
        }

        return max(50, 100 - ((0.7 - $ratio) * 100));
    }

    private function isPowerWithinNormalRange(Device $device): bool
    {
        if ($device->power <= 0 || $device->deviceLibrary?->power <= 0) {
            return true;
        }

        $ratio = $device->power / $device->deviceLibrary->power;

        return $ratio >= 0.5 && $ratio <= 1.2;
    }

    private function calculateUptimeDays(Device $device): int
    {
        if ($device->status !== 'online') {
            return 0;
        }

        $lastOfflineLog = DetectionLog::where('type', 'auto')
            ->orderBy('started_at', 'desc')
            ->limit(100)
            ->get()
            ->first(function ($log) use ($device) {
                $details = is_array($log->details) ? $log->details : [];
                foreach ($details as $detail) {
                    if (isset($detail['ip']) && $detail['ip'] === $device->ip_address && !($detail['is_online'] ?? false)) {
                        return true;
                    }
                }
                return false;
            });

        if ($lastOfflineLog) {
            return (int) Carbon::parse($lastOfflineLog->started_at)->diffInDays(now());
        }

        return (int) Carbon::parse($device->created_at)->diffInDays(now());
    }

    private function getMaintenanceRecommendation(float $healthScore, float $onlineRate, float $stabilityScore): string
    {
        if ($healthScore >= 80 && $onlineRate >= 95) {
            return '设备运行状态良好，建议进行常规巡检';
        }

        $recommendations = [];

        if ($onlineRate < 90) {
            $recommendations[] = '网络连接不稳定，建议检查网络链路';
        }

        if ($stabilityScore < 70) {
            $recommendations[] = '设备状态频繁切换，建议进行硬件检测';
        }

        if ($healthScore < 60) {
            $recommendations[] = '设备健康度下降，建议安排维护检查';
        }

        if (empty($recommendations)) {
            return '设备状态基本正常，建议持续监控';
        }

        return implode('；', $recommendations);
    }

    public function analyzeRackHealth(int $rackId): array
    {
        $rack = Rack::with(['devices.deviceLibrary', 'room'])->findOrFail($rackId);

        if ($rack->devices->isEmpty()) {
            return [
                'rack_id' => $rackId,
                'rack_name' => $rack->name,
                'device_count' => 0,
                'overall_health_score' => 100.0,
                'health_distribution' => [],
                'critical_devices' => [],
                'maintenance_priority' => 'none',
            ];
        }

        $deviceHealthScores = [];
        $criticalDevices = [];
        $totalScore = 0;

        foreach ($rack->devices as $device) {
            $health = $this->analyzeDeviceHealth($device->id);
            $deviceHealthScores[$device->id] = $health;
            $totalScore += $health['health_score'];

            if ($health['risk_level'] === 'critical' || $health['risk_level'] === 'high') {
                $criticalDevices[] = [
                    'id' => $device->id,
                    'name' => $device->name,
                    'health_score' => $health['health_score'],
                    'risk_level' => $health['risk_level'],
                    'issue' => $health['maintenance_recommendation'],
                ];
            }
        }

        $avgHealthScore = $totalScore / count($rack->devices);

        $healthDistribution = [
            'excellent' => count(array_filter($deviceHealthScores, fn ($h) => $h['health_score'] >= 90)),
            'good' => count(array_filter($deviceHealthScores, fn ($h) => $h['health_score'] >= 75 && $h['health_score'] < 90)),
            'fair' => count(array_filter($deviceHealthScores, fn ($h) => $h['health_score'] >= 60 && $h['health_score'] < 75)),
            'poor' => count(array_filter($deviceHealthScores, fn ($h) => $h['health_score'] >= 40 && $h['health_score'] < 60)),
            'critical' => count(array_filter($deviceHealthScores, fn ($h) => $h['health_score'] < 40)),
        ];

        $maintenancePriority = 'none';
        if ($avgHealthScore < 50) {
            $maintenancePriority = 'critical';
        } elseif ($avgHealthScore < 70) {
            $maintenancePriority = 'high';
        } elseif ($avgHealthScore < 80) {
            $maintenancePriority = 'medium';
        } elseif ($avgHealthScore < 90) {
            $maintenancePriority = 'low';
        }

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'room_name' => $rack->room?->name,
            'device_count' => $rack->devices->count(),
            'overall_health_score' => round($avgHealthScore, 1),
            'health_distribution' => $healthDistribution,
            'critical_devices' => $criticalDevices,
            'maintenance_priority' => $maintenancePriority,
            'device_details' => $deviceHealthScores,
        ];
    }

    public function getSystemHealthOverview(): array
    {
        $rooms = Room::with(['racks.devices'])->get();

        $allDevicesHealth = [];
        $criticalCount = 0;
        $warningCount = 0;
        $totalDevices = 0;
        $totalScore = 0;

        foreach ($rooms as $room) {
            foreach ($room->racks as $rack) {
                foreach ($rack->devices as $device) {
                    $health = $this->analyzeDeviceHealth($device->id);
                    $allDevicesHealth[] = $health;
                    $totalScore += $health['health_score'];
                    $totalDevices++;

                    if ($health['risk_level'] === 'critical') {
                        $criticalCount++;
                    } elseif ($health['risk_level'] === 'high') {
                        $warningCount++;
                    }
                }
            }
        }

        $avgHealthScore = $totalDevices > 0 ? $totalScore / $totalDevices : 100;

        $healthDistribution = [
            'excellent' => count(array_filter($allDevicesHealth, fn ($h) => $h['health_score'] >= 90)),
            'good' => count(array_filter($allDevicesHealth, fn ($h) => $h['health_score'] >= 75 && $h['health_score'] < 90)),
            'fair' => count(array_filter($allDevicesHealth, fn ($h) => $h['health_score'] >= 60 && $h['health_score'] < 75)),
            'poor' => count(array_filter($allDevicesHealth, fn ($h) => $h['health_score'] >= 40 && $h['health_score'] < 60)),
            'critical' => count(array_filter($allDevicesHealth, fn ($h) => $h['health_score'] < 40)),
        ];

        usort($allDevicesHealth, fn ($a, $b) => $a['health_score'] <=> $b['health_score']);

        return [
            'total_devices' => $totalDevices,
            'overall_health_score' => round($avgHealthScore, 1),
            'health_distribution' => $healthDistribution,
            'critical_devices' => $criticalCount,
            'warning_devices' => $warningCount,
            'healthy_devices' => $totalDevices - $criticalCount - $warningCount,
            'bottom_ten_devices' => array_slice($allDevicesHealth, 0, 10),
            'maintenance_alerts' => $this->generateMaintenanceAlerts($allDevicesHealth),
        ];
    }

    private function generateMaintenanceAlerts(array $devicesHealth): array
    {
        $alerts = [];

        $criticalDevices = array_filter($devicesHealth, fn ($d) => $d['risk_level'] === 'critical');
        if (count($criticalDevices) > 0) {
            $alerts[] = [
                'level' => 'critical',
                'message' => '有 ' . count($criticalDevices) . ' 台设备健康度严重下降，需要立即处理',
                'devices' => array_map(fn ($d) => $d['device_name'], $criticalDevices),
            ];
        }

        $offlineDevices = array_filter($devicesHealth, fn ($d) => $d['online_rate'] < 50);
        if (count($offlineDevices) > 0) {
            $alerts[] = [
                'level' => 'warning',
                'message' => '有 ' . count($offlineDevices) . ' 台设备离线率较高，请检查网络连接',
                'devices' => array_map(fn ($d) => $d['device_name'], $offlineDevices),
            ];
        }

        $unstableDevices = array_filter($devicesHealth, fn ($d) => $d['stability_score'] < 60);
        if (count($unstableDevices) > 0) {
            $alerts[] = [
                'level' => 'warning',
                'message' => '有 ' . count($unstableDevices) . ' 台设备运行不稳定，建议进行检测',
                'devices' => array_map(fn ($d) => $d['device_name'], $unstableDevices),
            ];
        }

        return $alerts;
    }
}
