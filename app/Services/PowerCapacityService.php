<?php

namespace App\Services;

use App\Models\Device;
use App\Models\Rack;
use App\Models\Room;
use Illuminate\Support\Collection;

class PowerCapacityService
{
    public function calculateRackCurrentPower(int $rackId): float
    {
        $rack = Rack::with('devices')->findOrFail($rackId);

        return (float) $rack->devices->sum('power');
    }

    public function analyzeRackPower(int $rackId): array
    {
        $rack = Rack::with(['devices.deviceLibrary', 'room'])->findOrFail($rackId);

        $totalPower = (float) $rack->devices->sum('power');
        $powerLimit = (float) ($rack->power ?? 0);
        $utilization = $powerLimit > 0 ? ($totalPower / $powerLimit) * 100 : 0;

        $devicePowers = $rack->devices->groupBy('category')->map(function ($devices) {
            return [
                'count' => $devices->count(),
                'total_power' => (float) $devices->sum('power'),
            ];
        });

        $powerDistribution = [];
        foreach ($devicePowers as $category => $data) {
            $powerDistribution[] = [
                'category' => $category,
                'device_count' => $data['count'],
                'total_power' => $data['total_power'],
                'percentage' => $totalPower > 0 ? round(($data['total_power'] / $totalPower) * 100, 1) : 0,
            ];
        }

        $status = 'normal';
        $warning = null;

        if ($powerLimit > 0) {
            if ($utilization >= 90) {
                $status = 'critical';
                $warning = '电源容量即将超载，当前负载 ' . round($utilization, 1) . '%';
            } elseif ($utilization >= 80) {
                $status = 'warning';
                $warning = '电源容量接近上限，当前负载 ' . round($utilization, 1) . '%';
            }
        }

        $powerTrend = $this->analyzePowerTrend($rack);

        $redundancyAnalysis = $this->analyzePowerRedundancy($rack);

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'room_name' => $rack->room?->name,
            'power_limit' => $powerLimit,
            'current_power' => $totalPower,
            'available_power' => $powerLimit > 0 ? max(0, $powerLimit - $totalPower) : 0,
            'utilization' => round($utilization, 2),
            'status' => $status,
            'warning' => $warning,
            'device_count' => $rack->devices->count(),
            'power_distribution' => $powerDistribution,
            'power_trend' => $powerTrend,
            'redundancy' => $redundancyAnalysis,
        ];
    }

    private function analyzePowerTrend(Rack $rack): array
    {
        $devicesByPower = $rack->devices->sortByDesc('power')->take(5);

        $highPowerDevices = [];
        foreach ($devicesByPower as $device) {
            if ($device->power > 0) {
                $highPowerDevices[] = [
                    'id' => $device->id,
                    'name' => $device->name,
                    'power' => $device->power,
                    'u_position' => $device->u_position,
                ];
            }
        }

        return [
            'high_power_devices' => $highPowerDevices,
            'average_power_per_device' => $rack->devices->count() > 0
                ? round($rack->devices->sum('power') / $rack->devices->count(), 1)
                : 0,
        ];
    }

    private function analyzePowerRedundancy(Rack $rack): array
    {
        $hasRedundantPower = false;
        $powerSupplies = 0;
        $activePowerSupplies = 0;

        foreach ($rack->devices as $device) {
            if ($device->power > 0) {
                $powerSupplies++;
                if ($device->status === 'online') {
                    $activePowerSupplies++;
                }
            }
        }

        if ($powerSupplies >= 2 && $activePowerSupplies >= 2) {
            $hasRedundantPower = true;
        }

        $redundancyCapacity = 0;
        if ($hasRedundantPower && $rack->power > 0) {
            $redundancyCapacity = ($rack->power / 2) - ($rack->devices->sum('power') / 2);
            if ($redundancyCapacity < 0) {
                $redundancyCapacity = 0;
            }
        }

        return [
            'has_redundant_power' => $hasRedundantPower,
            'total_power_supplies' => $powerSupplies,
            'active_power_supplies' => $activePowerSupplies,
            'redundancy_capacity' => round($redundancyCapacity, 1),
            'recommendation' => $this->getRedundancyRecommendation($rack, $hasRedundantPower, $powerLimit ?? 0),
        ];
    }

    private function getRedundancyRecommendation(Rack $rack, bool $hasRedundantPower, float $powerLimit): string
    {
        if (!$hasRedundantPower && $rack->devices->count() > 1) {
            return '建议为高功率设备配置冗余电源模块，以提高系统可靠性';
        }

        if ($hasRedundantPower && $powerLimit > 0) {
            $utilization = ($rack->devices->sum('power') / $powerLimit) * 100;
            if ($utilization > 70) {
                return '当前负载较高，建议降低电源利用率至70%以下以保证冗余容量';
            }
        }

        return '电源冗余配置正常';
    }

    public function analyzeRoomPower(int $roomId): array
    {
        $room = Room::with(['racks.devices.deviceLibrary'])->findOrFail($roomId);

        $racksAnalysis = [];
        $totalPower = 0;
        $totalLimit = 0;

        foreach ($room->racks as $rack) {
            $rackPower = (float) $rack->devices->sum('power');
            $rackLimit = (float) ($rack->power ?? 0);

            $totalPower += $rackPower;
            if ($rackLimit > 0) {
                $totalLimit += $rackLimit;
            }

            $racksAnalysis[] = [
                'rack_id' => $rack->id,
                'rack_name' => $rack->name,
                'current_power' => $rackPower,
                'power_limit' => $rackLimit,
                'utilization' => $rackLimit > 0 ? round(($rackPower / $rackLimit) * 100, 2) : 0,
                'status' => $this->getRackPowerStatus($rackPower, $rackLimit),
            ];
        }

        usort($racksAnalysis, fn ($a, $b) => $b['utilization'] <=> $a['utilization']);

        $roomUtilization = $totalLimit > 0 ? ($totalPower / $totalLimit) * 100 : 0;

        $powerDistribution = $this->calculatePowerZoneDistribution($room);

        return [
            'room_id' => $roomId,
            'room_name' => $room->name,
            'rack_count' => $room->racks->count(),
            'total_power' => $totalPower,
            'total_limit' => $totalLimit,
            'available_power' => max(0, $totalLimit - $totalPower),
            'utilization' => round($roomUtilization, 2),
            'status' => $this->getRoomPowerStatus($roomUtilization),
            'racks' => $racksAnalysis,
            'power_distribution' => $powerDistribution,
            'high_load_racks' => array_filter($racksAnalysis, fn ($r) => $r['utilization'] >= 80),
        ];
    }

    private function getRackPowerStatus(float $current, float $limit): string
    {
        if ($limit <= 0) {
            return 'unknown';
        }

        $utilization = ($current / $limit) * 100;

        if ($utilization >= 90) {
            return 'critical';
        } elseif ($utilization >= 80) {
            return 'warning';
        }

        return 'normal';
    }

    private function getRoomPowerStatus(float $utilization): string
    {
        if ($utilization >= 90) {
            return 'critical';
        } elseif ($utilization >= 80) {
            return 'warning';
        }

        return 'normal';
    }

    private function calculatePowerZoneDistribution(Room $room): array
    {
        $zones = [];
        $rackIndex = 0;

        foreach ($room->racks as $rack) {
            $zoneIndex = (int) ($rackIndex / 4);
            $rackPower = (float) $rack->devices->sum('power');

            if (!isset($zones[$zoneIndex])) {
                $zones[$zoneIndex] = [
                    'zone' => $zoneIndex + 1,
                    'label' => "区域 " . ($zoneIndex + 1),
                    'rack_count' => 0,
                    'total_power' => 0,
                    'power_limit' => 0,
                    'racks' => [],
                ];
            }

            $zones[$zoneIndex]['rack_count']++;
            $zones[$zoneIndex]['total_power'] += $rackPower;
            if ($rack->power > 0) {
                $zones[$zoneIndex]['power_limit'] += $rack->power;
            }
            $zones[$zoneIndex]['racks'][] = $rack->name;

            $rackIndex++;
        }

        foreach ($zones as &$zone) {
            $zone['utilization'] = $zone['power_limit'] > 0
                ? round(($zone['total_power'] / $zone['power_limit']) * 100, 2)
                : 0;
            $zone['average_power'] = $zone['rack_count'] > 0
                ? round($zone['total_power'] / $zone['rack_count'], 1)
                : 0;
        }

        return array_values($zones);
    }

    public function getSystemPowerOverview(): array
    {
        $rooms = Room::with(['racks.devices'])->get();

        $totalPower = 0;
        $totalLimit = 0;
        $criticalRacks = [];
        $warningRacks = [];

        foreach ($rooms as $room) {
            foreach ($room->racks as $rack) {
                $rackPower = (float) $rack->devices->sum('power');
                $rackLimit = (float) ($rack->power ?? 0);

                $totalPower += $rackPower;
                if ($rackLimit > 0) {
                    $totalLimit += $rackLimit;
                }

                if ($rackLimit > 0) {
                    $utilization = ($rackPower / $rackLimit) * 100;

                    if ($utilization >= 90) {
                        $criticalRacks[] = [
                            'room' => $room->name,
                            'rack' => $rack->name,
                            'utilization' => round($utilization, 1),
                            'power' => $rackPower,
                            'limit' => $rackLimit,
                        ];
                    } elseif ($utilization >= 80) {
                        $warningRacks[] = [
                            'room' => $room->name,
                            'rack' => $rack->name,
                            'utilization' => round($utilization, 1),
                            'power' => $rackPower,
                            'limit' => $rackLimit,
                        ];
                    }
                }
            }
        }

        $utilization = $totalLimit > 0 ? ($totalPower / $totalLimit) * 100 : 0;

        return [
            'total_power' => $totalPower,
            'total_limit' => $totalLimit,
            'available_power' => max(0, $totalLimit - $totalPower),
            'system_utilization' => round($utilization, 2),
            'status' => $this->getRoomPowerStatus($utilization),
            'critical_racks' => $criticalRacks,
            'warning_racks' => $warningRacks,
            'critical_count' => count($criticalRacks),
            'warning_count' => count($warningRacks),
        ];
    }

    public function calculatePowerBalanceScore(int $rackId): array
    {
        $rack = Rack::with('devices')->findOrFail($rackId);

        $leftPower = 0;
        $rightPower = 0;
        $leftDevices = 0;
        $rightDevices = 0;

        $rackCenter = $rack->u_count / 2;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            $deviceCenter = $device->u_position + ($deviceHeight - 1) / 2;

            if ($deviceCenter < $rackCenter) {
                $leftPower += $device->power ?? 0;
                $leftDevices++;
            } else {
                $rightPower += $device->power ?? 0;
                $rightDevices++;
            }
        }

        $totalPower = $leftPower + $rightPower;
        $balanceRatio = $totalPower > 0 ? abs($leftPower - $rightPower) / $totalPower : 0;

        $score = 100 - ($balanceRatio * 100);
        $status = $balanceRatio < 0.1 ? 'balanced' : ($balanceRatio < 0.2 ? 'acceptable' : 'unbalanced');

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'left_power' => $leftPower,
            'right_power' => $rightPower,
            'left_devices' => $leftDevices,
            'right_devices' => $rightDevices,
            'total_power' => $totalPower,
            'balance_ratio' => round($balanceRatio * 100, 1),
            'balance_score' => round($score, 1),
            'status' => $status,
            'recommendation' => $this->getBalanceRecommendation($balanceRatio, $leftPower, $rightPower),
        ];
    }

    private function getBalanceRecommendation(float $balanceRatio, float $leftPower, float $rightPower): string
    {
        if ($balanceRatio < 0.1) {
            return '电源负载分布均衡良好';
        }

        if ($balanceRatio < 0.2) {
            return '电源负载略有偏差，建议关注';
        }

        if ($leftPower > $rightPower) {
            return "左侧电源负载较高（{$leftPower}W vs {$rightPower}W），建议将部分设备移至右侧或降低左侧负载";
        }

        return "右侧电源负载较高（{$rightPower}W vs {$leftPower}W），建议将部分设备移至左侧或降低右侧负载";
    }
}
