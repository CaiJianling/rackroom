<?php

namespace App\Services;

use App\Models\Device;
use App\Models\Rack;
use App\Models\Room;
use Illuminate\Support\Facades\DB;

class CapacityPlanningService
{
    public function getSystemCapacityOverview(): array
    {
        $rooms = Room::with(['racks.devices.deviceLibrary', 'racks.rackType'])->get();

        $totalSpaceU = 0;
        $usedSpaceU = 0;
        $totalPower = 0;
        $usedPower = 0;
        $roomStats = [];

        foreach ($rooms as $room) {
            $roomSpaceU = 0;
            $roomUsedU = 0;
            $roomPower = 0;
            $roomUsedPower = 0;

            foreach ($room->racks as $rack) {
                $rackU = $rack->u_count ?? 42;
                $totalU = $rackU;
                $occupiedU = 0;

                foreach ($rack->devices as $device) {
                    $deviceU = $device->deviceLibrary?->u_height ?? 1;
                    $occupiedU += $deviceU;
                }

                $totalSpaceU += $totalU;
                $usedSpaceU += $occupiedU;
                $roomSpaceU += $totalU;
                $roomUsedU += $occupiedU;

                $rackPowerLimit = $rack->power ?? 0;
                $rackPowerUsed = $rack->devices->sum('power') ?? 0;

                $totalPower += $rackPowerLimit;
                $usedPower += $rackPowerUsed;
                $roomPower += $rackPowerLimit;
                $roomUsedPower += $rackPowerUsed;
            }

            $roomStats[] = [
                'room_id' => $room->id,
                'room_name' => $room->name,
                'rack_count' => $room->racks->count(),
                'device_count' => $room->racks->sum(fn ($r) => $r->devices->count()),
                'total_u' => $roomSpaceU,
                'used_u' => $roomUsedU,
                'utilization_rate' => $roomSpaceU > 0 ? round(($roomUsedU / $roomSpaceU) * 100, 1) : 0,
                'total_power' => $roomPower,
                'used_power' => $roomUsedPower,
                'power_utilization' => $roomPower > 0 ? round(($roomUsedPower / $roomPower) * 100, 1) : 0,
            ];
        }

        return [
            'total_space_u' => $totalSpaceU,
            'used_space_u' => $usedSpaceU,
            'space_utilization' => $totalSpaceU > 0 ? round(($usedSpaceU / $totalSpaceU) * 100, 1) : 0,
            'available_space_u' => $totalSpaceU - $usedSpaceU,
            'total_power' => $totalPower,
            'used_power' => $usedPower,
            'power_utilization' => $totalPower > 0 ? round(($usedPower / $totalPower) * 100, 1) : 0,
            'available_power' => $totalPower - $usedPower,
            'total_rooms' => $rooms->count(),
            'total_racks' => $rooms->sum(fn ($r) => $r->racks->count()),
            'total_devices' => $rooms->sum(fn ($r) => $r->racks->sum(fn ($rack) => $rack->devices->count())),
            'room_stats' => $roomStats,
        ];
    }

    public function getRackCapacityTrend(int $rackId, int $months = 6): array
    {
        $rack = Rack::with(['devices.deviceLibrary'])->findOrFail($rackId);

        $currentU = 0;
        foreach ($rack->devices as $device) {
            $currentU += $device->deviceLibrary?->u_height ?? 1;
        }

        $currentPower = $rack->devices->sum('power') ?? 0;
        $maxU = $rack->u_count ?? 42;
        $maxPower = $rack->power ?? 0;

        $monthlyData = [];
        $today = now();

        for ($i = $months - 1; $i >= 0; $i--) {
            $date = $today->copy()->subMonths($i);
            $monthLabel = $date->format('Y-m');

            $growthRate = $this->calculateHistoricalGrowthRate($rackId, $date);

            $baseU = max(0, $currentU - ($growthRate['cumulative_u_growth'] ?? 0));
            $basePower = max(0, $currentPower - ($growthRate['cumulative_power_growth'] ?? 0));

            $projectedU = $baseU;
            $projectedPower = $basePower;

            $monthlyData[] = [
                'month' => $monthLabel,
                'space_used' => $baseU,
                'space_utilization' => $maxU > 0 ? round(($baseU / $maxU) * 100, 1) : 0,
                'power_used' => $basePower,
                'power_utilization' => $maxPower > 0 ? round(($basePower / $maxPower) * 100, 1) : 0,
                'is_projected' => $i > 0,
            ];
        }

        $spacePrediction = $this->predictExhaustion($currentU, $maxU, $months);
        $powerPrediction = $this->predictExhaustion($currentPower, $maxPower, $months);

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'max_u' => $maxU,
            'current_u' => $currentU,
            'current_power' => $currentPower,
            'max_power' => $maxPower,
            'monthly_data' => $monthlyData,
            'space_prediction' => $spacePrediction,
            'power_prediction' => $powerPrediction,
        ];
    }

    public function getRoomCapacityTrend(int $roomId, int $months = 6): array
    {
        $room = Room::with(['racks.devices.deviceLibrary'])->findOrFail($roomId);

        $monthlyData = [];
        $today = now();

        for ($i = $months - 1; $i >= 0; $i--) {
            $date = $today->copy()->subMonths($i);
            $monthLabel = $date->format('Y-m');

            $totalU = 0;
            $usedU = 0;
            $totalPower = 0;
            $usedPower = 0;

            foreach ($room->racks as $rack) {
                $totalU += $rack->u_count ?? 42;
                $totalPower += $rack->power ?? 0;

                $rackGrowthRate = $this->calculateHistoricalGrowthRate($rack->id, $date);

                $currentRackU = 0;
                $currentRackPower = 0;
                foreach ($rack->devices as $device) {
                    $currentRackU += $device->deviceLibrary?->u_height ?? 1;
                    $currentRackPower += $device->power ?? 0;
                }

                $adjustedU = max(0, $currentRackU - ($rackGrowthRate['cumulative_u_growth'] ?? 0));
                $adjustedPower = max(0, $currentRackPower - ($rackGrowthRate['cumulative_power_growth'] ?? 0));

                $usedU += $adjustedU;
                $usedPower += $adjustedPower;
            }

            $monthlyData[] = [
                'month' => $monthLabel,
                'total_u' => $totalU,
                'used_u' => $usedU,
                'utilization' => $totalU > 0 ? round(($usedU / $totalU) * 100, 1) : 0,
                'total_power' => $totalPower,
                'used_power' => $usedPower,
                'power_utilization' => $totalPower > 0 ? round(($usedPower / $totalPower) * 100, 1) : 0,
                'is_projected' => $i > 0,
            ];
        }

        $totalMaxU = $room->racks->sum(fn ($r) => $r->u_count ?? 42);
        $totalMaxPower = $room->racks->sum(fn ($r) => $r->power ?? 0);
        $currentUsedU = $room->racks->sum(fn ($r) => $r->devices->sum(fn ($d) => $d->deviceLibrary?->u_height ?? 1));
        $currentUsedPower = $room->racks->sum(fn ($r) => $r->devices->sum('power') ?? 0);

        return [
            'room_id' => $roomId,
            'room_name' => $room->name,
            'rack_count' => $room->racks->count(),
            'monthly_data' => $monthlyData,
            'space_prediction' => $this->predictExhaustion($currentUsedU, $totalMaxU, $months),
            'power_prediction' => $this->predictExhaustion($currentUsedPower, $totalMaxPower, $months),
        ];
    }

    private function calculateHistoricalGrowthRate(int $rackId, \Carbon\Carbon $date): array
    {
        $deviceCount = Device::where('rack_id', $rackId)
            ->where('created_at', '<=', $date->endOfMonth())
            ->count();

        $devices = Device::where('rack_id', $rackId)
            ->where('created_at', '<=', $date->endOfMonth())
            ->with('deviceLibrary')
            ->get();

        $totalU = $devices->sum(fn ($d) => $d->deviceLibrary?->u_height ?? 1);
        $totalPower = $devices->sum('power') ?? 0;

        return [
            'device_count' => $deviceCount,
            'total_u' => $totalU,
            'total_power' => $totalPower,
            'cumulative_u_growth' => 0,
            'cumulative_power_growth' => 0,
        ];
    }

    private function predictExhaustion(float $current, float $max, int $months): array
    {
        if ($current >= $max) {
            return [
                'status' => 'exhausted',
                'message' => '容量已耗尽',
                'months_remaining' => 0,
                'projected_date' => now()->format('Y-m-d'),
            ];
        }

        $remaining = $max - $current;
        $monthlyGrowthRate = $this->estimateMonthlyGrowthRate($current, $max, $months);

        if ($monthlyGrowthRate <= 0) {
            return [
                'status' => 'stable',
                'message' => '容量使用稳定，近期无需扩容',
                'months_remaining' => null,
                'projected_date' => null,
                'growth_rate' => 0,
            ];
        }

        $monthsRemaining = floor($remaining / $monthlyGrowthRate);

        if ($monthsRemaining > 24) {
            return [
                'status' => 'adequate',
                'message' => "预计 {$monthsRemaining} 个月后需要扩容",
                'months_remaining' => $monthsRemaining,
                'projected_date' => now()->addMonths($monthsRemaining)->format('Y-m-d'),
                'growth_rate' => round($monthlyGrowthRate, 2),
            ];
        } elseif ($monthsRemaining > 6) {
            return [
                'status' => 'warning',
                'message' => "预计 {$monthsRemaining} 个月后需要扩容",
                'months_remaining' => $monthsRemaining,
                'projected_date' => now()->addMonths($monthsRemaining)->format('Y-m-d'),
                'growth_rate' => round($monthlyGrowthRate, 2),
            ];
        } else {
            return [
                'status' => 'critical',
                'message' => "预计 {$monthsRemaining} 个月后容量不足，建议立即规划扩容",
                'months_remaining' => $monthsRemaining,
                'projected_date' => now()->addMonths($monthsRemaining)->format('Y-m-d'),
                'growth_rate' => round($monthlyGrowthRate, 2),
            ];
        }
    }

    private function estimateMonthlyGrowthRate(float $current, float $max, int $months): float
    {
        if ($current <= 0 || $max <= 0) {
            return 0;
        }

        $utilization = $current / $max;

        if ($utilization < 0.5) {
            return max(0.5, ($max * 0.1) / $months);
        } elseif ($utilization < 0.7) {
            return max(1, ($max * 0.15) / $months);
        } elseif ($utilization < 0.85) {
            return max(2, ($max * 0.2) / $months);
        } else {
            return max(3, ($max * 0.25) / $months);
        }
    }

    public function getCapacityWarnings(): array
    {
        $warnings = [];

        $rooms = Room::with(['racks.devices.deviceLibrary', 'racks.rackType'])->get();

        foreach ($rooms as $room) {
            foreach ($room->racks as $rack) {
                $maxU = $rack->u_count ?? 42;
                $maxPower = $rack->power ?? 0;
                $usedU = 0;
                $usedPower = 0;

                foreach ($rack->devices as $device) {
                    $usedU += $device->deviceLibrary?->u_height ?? 1;
                    $usedPower += $device->power ?? 0;
                }

                $spaceUtil = $maxU > 0 ? ($usedU / $maxU) * 100 : 0;
                $powerUtil = $maxPower > 0 ? ($usedPower / $maxPower) * 100 : 0;

                if ($spaceUtil >= 90) {
                    $warnings[] = [
                        'type' => 'critical',
                        'level' => 'space',
                        'rack_id' => $rack->id,
                        'rack_name' => $rack->name,
                        'room_name' => $room->name,
                        'message' => "机柜 {$rack->name} 空间使用率已达 " . round($spaceUtil, 1) . "%，即将耗尽",
                        'current_value' => round($spaceUtil, 1),
                        'threshold' => 90,
                    ];
                } elseif ($spaceUtil >= 80) {
                    $warnings[] = [
                        'type' => 'warning',
                        'level' => 'space',
                        'rack_id' => $rack->id,
                        'rack_name' => $rack->name,
                        'room_name' => $room->name,
                        'message' => "机柜 {$rack->name} 空间使用率已达 " . round($spaceUtil, 1) . "%，建议关注",
                        'current_value' => round($spaceUtil, 1),
                        'threshold' => 80,
                    ];
                }

                if ($powerUtil >= 90) {
                    $warnings[] = [
                        'type' => 'critical',
                        'level' => 'power',
                        'rack_id' => $rack->id,
                        'rack_name' => $rack->name,
                        'room_name' => $room->name,
                        'message' => "机柜 {$rack->name} 电源使用率已达 " . round($powerUtil, 1) . "%，存在过载风险",
                        'current_value' => round($powerUtil, 1),
                        'threshold' => 90,
                    ];
                } elseif ($powerUtil >= 80) {
                    $warnings[] = [
                        'type' => 'warning',
                        'level' => 'power',
                        'rack_id' => $rack->id,
                        'rack_name' => $rack->name,
                        'room_name' => $room->name,
                        'message' => "机柜 {$rack->name} 电源使用率已达 " . round($powerUtil, 1) . "%，建议关注",
                        'current_value' => round($powerUtil, 1),
                        'threshold' => 80,
                    ];
                }
            }
        }

        usort($warnings, function ($a, $b) {
            $priority = ['critical' => 0, 'warning' => 1];
            $aPriority = $priority[$a['type']] ?? 2;
            $bPriority = $priority[$b['type']] ?? 2;
            return $aPriority <=> $bPriority;
        });

        return $warnings;
    }

    public function getCapacityForecast(int $months = 12): array
    {
        $overview = $this->getSystemCapacityOverview();

        $spaceForecast = [];
        $powerForecast = [];

        $currentSpaceUtil = $overview['space_utilization'];
        $currentPowerUtil = $overview['power_utilization'];

        for ($i = 0; $i <= $months; $i++) {
            $date = now()->addMonths($i);
            $monthLabel = $date->format('Y-m');

            $growthFactor = 1 + ($i * 0.02);

            $projectedSpaceUtil = min(100, $currentSpaceUtil * $growthFactor);
            $projectedPowerUtil = min(100, $currentPowerUtil * $growthFactor);

            $spaceStatus = 'normal';
            if ($projectedSpaceUtil >= 90) {
                $spaceStatus = 'critical';
            } elseif ($projectedSpaceUtil >= 80) {
                $spaceStatus = 'warning';
            }

            $powerStatus = 'normal';
            if ($projectedPowerUtil >= 90) {
                $powerStatus = 'critical';
            } elseif ($projectedPowerUtil >= 80) {
                $powerStatus = 'warning';
            }

            $spaceForecast[] = [
                'month' => $monthLabel,
                'utilization' => round($projectedSpaceUtil, 1),
                'status' => $spaceStatus,
            ];

            $powerForecast[] = [
                'month' => $monthLabel,
                'utilization' => round($projectedPowerUtil, 1),
                'status' => $powerStatus,
            ];
        }

        return [
            'current_overview' => $overview,
            'space_forecast' => $spaceForecast,
            'power_forecast' => $powerForecast,
            'recommendations' => $this->generateCapacityRecommendations($overview, $spaceForecast, $powerForecast),
        ];
    }

    private function generateCapacityRecommendations(array $overview, array $spaceForecast, array $powerForecast): array
    {
        $recommendations = [];

        $maxSpaceUtil = max(array_column($spaceForecast, 'utilization'));
        $maxPowerUtil = max(array_column($powerForecast, 'utilization'));

        if ($maxSpaceUtil >= 90) {
            $criticalMonth = null;
            foreach ($spaceForecast as $forecast) {
                if ($forecast['utilization'] >= 90 && $criticalMonth === null) {
                    $criticalMonth = $forecast['month'];
                    break;
                }
            }

            $recommendations[] = [
                'type' => 'space',
                'priority' => 'high',
                'message' => "空间容量预计在 {$criticalMonth} 达到临界点，建议启动扩容规划",
            ];
        }

        if ($maxPowerUtil >= 90) {
            $criticalMonth = null;
            foreach ($powerForecast as $forecast) {
                if ($forecast['utilization'] >= 90 && $criticalMonth === null) {
                    $criticalMonth = $forecast['month'];
                    break;
                }
            }

            $recommendations[] = [
                'type' => 'power',
                'priority' => 'high',
                'message' => "电源容量预计在 {$criticalMonth} 达到临界点，建议评估电力扩容方案",
            ];
        }

        if ($overview['space_utilization'] < 50 && $overview['power_utilization'] < 50) {
            $recommendations[] = [
                'type' => 'general',
                'priority' => 'low',
                'message' => '当前容量充足，可考虑优化现有资源利用率',
            ];
        }

        $lowUtilizationRooms = array_filter($overview['room_stats'], function ($room) {
            return $room['utilization_rate'] < 30;
        });

        if (count($lowUtilizationRooms) > 0) {
            $roomNames = implode(', ', array_column($lowUtilizationRooms, 'room_name'));
            $recommendations[] = [
                'type' => 'optimization',
                'priority' => 'medium',
                'message' => "机房 {$roomNames} 利用率偏低（<30%），可考虑整合或调整业务布局",
            ];
        }

        return $recommendations;
    }
}
