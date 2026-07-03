<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceLibrary;
use App\Models\Rack;
use Illuminate\Support\Collection;

class RackSpaceRecommendationService
{
    private const COOLING_PATTERN_TOP_DOWN = 'top_down';
    private const COOLING_PATTERN_BOTTOM_UP = 'bottom_up';

    public function __construct(
        private PowerCapacityService $powerCapacityService
    ) {}

    public function recommendUPosition(int $rackId, int $deviceHeight, ?int $deviceLibraryId = null): array
    {
        $rack = Rack::with(['devices.deviceLibrary', 'rackType'])->findOrFail($rackId);
        $rackPowerLimit = $rack->power ?? 0;

        $devicePower = 0;
        if ($deviceLibraryId) {
            $library = DeviceLibrary::find($deviceLibraryId);
            $devicePower = $library?->power ?? 0;
        }

        $occupiedSlots = $this->buildOccupancyMap($rack);
        $recommendations = [];

        for ($u = 1; $u <= $rack->u_count - $deviceHeight + 1; $u++) {
            $score = $this->calculatePositionScore($rack, $u, $deviceHeight, $occupiedSlots);

            if ($score['available']) {
                $remainingPower = $rackPowerLimit - $this->powerCapacityService->calculateRackCurrentPower($rack->id);
                $powerOk = ($remainingPower >= $devicePower);

                $recommendations[] = [
                    'u_position' => $u,
                    'u_end' => $u + $deviceHeight - 1,
                    'score' => $score['score'],
                    'reasons' => $score['reasons'],
                    'power_ok' => $powerOk,
                    'remaining_power' => $remainingPower,
                    'cooling_efficiency' => $this->calculateCoolingEfficiency($rack, $u, $deviceHeight),
                ];
            }
        }

        usort($recommendations, fn ($a, $b) => $b['score'] <=> $a['score']);

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'device_height' => $deviceHeight,
            'recommendations' => array_slice($recommendations, 0, 5),
        ];
    }

    private function buildOccupancyMap(Rack $rack): array
    {
        $map = [];
        for ($i = 1; $i <= $rack->u_count; $i++) {
            $map[$i] = false;
        }

        foreach ($rack->devices as $device) {
            $height = $device->deviceLibrary?->u_height ?? 1;
            for ($u = $device->u_position; $u < $device->u_position + $height; $u++) {
                if ($u >= 1 && $u <= $rack->u_count) {
                    $map[$u] = true;
                }
            }
        }

        return $map;
    }

    private function calculatePositionScore(Rack $rack, int $startU, int $height, array $occupiedSlots): array
    {
        $score = 100;
        $reasons = [];

        for ($u = $startU; $u < $startU + $height; $u++) {
            if ($occupiedSlots[$u] ?? false) {
                return ['available' => false, 'score' => 0, 'reasons' => ['位置已被占用']];
            }
        }

        $deviceCount = count($rack->devices);
        if ($deviceCount == 0) {
            $score += 20;
            $reasons[] = '机柜为空，推荐中部位置';
        } else {
            $occupiedRanges = $this->getOccupiedRanges($rack);
            $nearbyDevices = $this->findNearbyDevices($occupiedRanges, $startU, $height);

            if (empty($nearbyDevices['above']) && empty($nearbyDevices['below'])) {
                $score += 15;
                $reasons[] = '附近无设备，散热条件最佳';
            } else {
                $distanceScore = $this->calculateDistanceScore($nearbyDevices, $startU, $height);
                $score += $distanceScore;

                if ($distanceScore > 10) {
                    $reasons[] = '与相邻设备保持安全距离';
                }
            }

            if ($this->isTopHeavyPlacement($rack, $startU, $height)) {
                $score -= 10;
                $reasons[] = '注意：高位设备可能影响散热';
            }

            if ($this->isPowerBalancedPlacement($rack, $startU, $height)) {
                $score += 10;
                $reasons[] = '电源负载分布均衡';
            }
        }

        $weightScore = $this->calculateWeightBalanceScore($rack, $startU, $height);
        $score += $weightScore;
        if ($weightScore > 0) {
            $reasons[] = '机柜重量分布合理';
        }

        return ['available' => true, 'score' => $score, 'reasons' => $reasons];
    }

    private function getOccupiedRanges(Rack $rack): array
    {
        $ranges = [];
        foreach ($rack->devices as $device) {
            $height = $device->deviceLibrary?->u_height ?? 1;
            $ranges[] = [
                'start' => $device->u_position,
                'end' => $device->u_position + $height - 1,
                'device_id' => $device->id,
                'power' => $device->power ?? 0,
            ];
        }
        return $ranges;
    }

    private function findNearbyDevices(array $occupiedRanges, int $startU, int $height): array
    {
        $endU = $startU + $height - 1;
        $above = [];
        $below = [];

        foreach ($occupiedRanges as $range) {
            if ($range['end'] < $startU) {
                $distance = $startU - $range['end'];
                $above[] = ['range' => $range, 'distance' => $distance];
            } elseif ($range['start'] > $endU) {
                $distance = $range['start'] - $endU;
                $below[] = ['range' => $range, 'distance' => $distance];
            }
        }

        usort($above, fn ($a, $b) => $a['distance'] <=> $b['distance']);
        usort($below, fn ($a, $b) => $a['distance'] <=> $b['distance']);

        return ['above' => array_slice($above, 0, 3), 'below' => array_slice($below, 0, 3)];
    }

    private function calculateDistanceScore(array $nearbyDevices, int $startU, int $height): int
    {
        $score = 0;
        $endU = $startU + $height - 1;

        foreach ($nearbyDevices['above'] as $item) {
            if ($item['distance'] >= 2) {
                $score += 5;
            } elseif ($item['distance'] == 1) {
                $score += 2;
            }
        }

        foreach ($nearbyDevices['below'] as $item) {
            if ($item['distance'] >= 2) {
                $score += 5;
            } elseif ($item['distance'] == 1) {
                $score += 2;
            }
        }

        return min($score, 15);
    }

    private function isTopHeavyPlacement(Rack $rack, int $startU, int $height): bool
    {
        $currentTopU = 0;
        $currentBottomU = $rack->u_count + 1;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            $currentTopU = max($currentTopU, $device->u_position + $deviceHeight - 1);
            $currentBottomU = min($currentBottomU, $device->u_position);
        }

        return ($startU + $height - 1) > $currentTopU && ($startU < $currentBottomU || $currentBottomU == $rack->u_count + 1);
    }

    private function isPowerBalancedPlacement(Rack $rack, int $startU, int $height): bool
    {
        $upperPower = 0;
        $lowerPower = 0;
        $midPower = 0;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            $deviceCenter = $device->u_position + ($deviceHeight - 1) / 2;
            $rackCenter = $rack->u_count / 2;

            if ($deviceCenter < $rackCenter - 5) {
                $lowerPower += $device->power ?? 0;
            } elseif ($deviceCenter > $rackCenter + 5) {
                $upperPower += $device->power ?? 0;
            } else {
                $midPower += $device->power ?? 0;
            }
        }

        $totalPower = $upperPower + $lowerPower + $midPower;
        if ($totalPower == 0) {
            return true;
        }

        $upperRatio = $upperPower / $totalPower;
        $lowerRatio = $lowerPower / $totalPower;

        return ($upperRatio > 0.3 && $upperRatio < 0.7) && ($lowerRatio > 0.3 && $lowerRatio < 0.7);
    }

    private function calculateWeightBalanceScore(Rack $rack, int $startU, int $height): int
    {
        $rackCenter = $rack->u_count / 2;
        $newDeviceCenter = $startU + ($height - 1) / 2;

        $leftWeight = 0;
        $rightWeight = 0;
        $centerWeight = 0;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            $deviceCenter = $device->u_position + ($deviceHeight - 1) / 2;
            $weight = $device->power > 0 ? $device->power : 1;

            if ($deviceCenter < $rackCenter - 3) {
                $leftWeight += $weight;
            } elseif ($deviceCenter > $rackCenter + 3) {
                $rightWeight += $weight;
            } else {
                $centerWeight += $weight;
            }
        }

        $newWeight = $height * 2;
        if ($newDeviceCenter < $rackCenter) {
            $leftWeight += $newWeight;
        } else {
            $rightWeight += $newWeight;
        }

        $totalWeight = $leftWeight + $rightWeight + $centerWeight;
        if ($totalWeight == 0) {
            return 5;
        }

        $balanceRatio = abs($leftWeight - $rightWeight) / $totalWeight;

        if ($balanceRatio < 0.1) {
            return 5;
        } elseif ($balanceRatio < 0.2) {
            return 3;
        } elseif ($balanceRatio < 0.3) {
            return 1;
        }

        return -3;
    }

    private function calculateCoolingEfficiency(Rack $rack, int $startU, int $height): string
    {
        $aboveCount = 0;
        $belowCount = 0;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            if ($device->u_position + $deviceHeight - 1 < $startU) {
                $aboveCount++;
            } elseif ($device->u_position > $startU + $height - 1) {
                $belowCount++;
            }
        }

        $totalNearby = $aboveCount + $belowCount;

        if ($totalNearby == 0) {
            return 'excellent';
        } elseif ($totalNearby <= 2) {
            return 'good';
        } elseif ($totalNearby <= 4) {
            return 'moderate';
        }

        return 'poor';
    }

    public function analyzeRackSpaceUtilization(int $rackId): array
    {
        $rack = Rack::with(['devices.deviceLibrary', 'rackType'])->findOrFail($rackId);

        $totalU = $rack->u_count;
        $occupiedU = 0;
        $deviceDetails = [];

        foreach ($rack->devices as $device) {
            $height = $device->deviceLibrary?->u_height ?? 1;
            $occupiedU += $height;

            $deviceDetails[] = [
                'id' => $device->id,
                'name' => $device->name,
                'u_position' => $device->u_position,
                'u_height' => $height,
                'power' => $device->power ?? 0,
                'category' => $device->category,
            ];
        }

        $freeU = $totalU - $occupiedU;
        $utilizationRate = $totalU > 0 ? round(($occupiedU / $totalU) * 100, 2) : 0;

        $gaps = $this->findFreeGaps($rack);

        $zones = $this->analyzeSpaceZones($rack);

        return [
            'rack_id' => $rackId,
            'rack_name' => $rack->name,
            'total_u' => $totalU,
            'occupied_u' => $occupiedU,
            'free_u' => $freeU,
            'utilization_rate' => $utilizationRate,
            'device_count' => count($rack->devices),
            'total_power' => $rack->devices->sum('power'),
            'power_limit' => $rack->power ?? 0,
            'power_utilization' => $rack->power > 0 ? round(($rack->devices->sum('power') / $rack->power) * 100, 2) : 0,
            'gaps' => $gaps,
            'zones' => $zones,
            'device_details' => $deviceDetails,
        ];
    }

    private function findFreeGaps(Rack $rack): array
    {
        $occupiedSlots = $this->buildOccupancyMap($rack);
        $gaps = [];
        $currentGapStart = null;

        for ($u = 1; $u <= $rack->u_count; $u++) {
            if (!$occupiedSlots[$u]) {
                if ($currentGapStart === null) {
                    $currentGapStart = $u;
                }
            } else {
                if ($currentGapStart !== null) {
                    $gaps[] = [
                        'start' => $currentGapStart,
                        'end' => $u - 1,
                        'size' => $u - $currentGapStart,
                    ];
                    $currentGapStart = null;
                }
            }
        }

        if ($currentGapStart !== null) {
            $gaps[] = [
                'start' => $currentGapStart,
                'end' => $rack->u_count,
                'size' => $rack->u_count - $currentGapStart + 1,
            ];
        }

        return $gaps;
    }

    private function analyzeSpaceZones(Rack $rack): array
    {
        $totalU = $rack->u_count;
        $zoneSize = 7;
        $zones = [];

        for ($zone = 0; $zone < ceil($totalU / $zoneSize); $zone++) {
            $zoneStart = $zone * $zoneSize + 1;
            $zoneEnd = min(($zone + 1) * $zoneSize, $totalU);

            $occupiedU = 0;
            $deviceCount = 0;
            $totalPower = 0;

            foreach ($rack->devices as $device) {
                $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
                $deviceEnd = $device->u_position + $deviceHeight - 1;

                if ($deviceEnd >= $zoneStart && $device->u_position <= $zoneEnd) {
                    $overlapStart = max($device->u_position, $zoneStart);
                    $overlapEnd = min($deviceEnd, $zoneEnd);
                    $occupiedU += max(0, $overlapEnd - $overlapStart + 1);
                    $deviceCount++;
                    $totalPower += $device->power ?? 0;
                }
            }

            $zones[] = [
                'zone' => $zone + 1,
                'label' => "U{$zoneStart}-U{$zoneEnd}",
                'start' => $zoneStart,
                'end' => $zoneEnd,
                'occupied_u' => $occupiedU,
                'total_u' => $zoneEnd - $zoneStart + 1,
                'utilization' => round((($zoneEnd - $zoneStart + 1) > 0) ? ($occupiedU / ($zoneEnd - $zoneStart + 1)) * 100 : 0, 1),
                'device_count' => $deviceCount,
                'power' => $totalPower,
            ];
        }

        return $zones;
    }

    public function compareRacksForDevice(int $deviceHeight, int $devicePower, array $rackIds = []): array
    {
        $query = Rack::with(['devices.deviceLibrary', 'rackType']);

        if (!empty($rackIds)) {
            $query->whereIn('id', $rackIds);
        }

        $racks = $query->get();
        $comparisons = [];

        foreach ($racks as $rack) {
            $currentPower = $rack->devices->sum('power');
            $powerOk = ($rack->power == 0) || ($currentPower + $devicePower <= $rack->power);

            $freeSlots = $this->findFreeGaps($rack);
            $canFit = false;
            $bestSlot = null;

            foreach ($freeSlots as $gap) {
                if ($gap['size'] >= $deviceHeight) {
                    $canFit = true;
                    if ($bestSlot === null || $gap['size'] < $bestSlot['size']) {
                        $bestSlot = $gap;
                    }
                }
            }

            $utilization = $this->analyzeRackSpaceUtilization($rack->id);

            $comparisons[] = [
                'rack_id' => $rack->id,
                'rack_name' => $rack->name,
                'room_name' => $rack->room?->name,
                'can_accommodate' => $canFit && $powerOk,
                'power_ok' => $powerOk,
                'power_utilization_current' => $utilization['power_utilization'],
                'power_utilization_after' => $rack->power > 0
                    ? round((($currentPower + $devicePower) / $rack->power) * 100, 2)
                    : 0,
                'space_utilization_current' => $utilization['utilization_rate'],
                'space_utilization_after' => round((($utilization['occupied_u'] + $deviceHeight) / $utilization['total_u']) * 100, 2),
                'best_u_position' => $bestSlot['start'] ?? null,
                'rating' => $this->calculateRackSuitabilityScore($rack, $deviceHeight, $devicePower),
            ];
        }

        usort($comparisons, fn ($a, $b) => $b['rating'] <=> $a['rating']);

        return [
            'device_height' => $deviceHeight,
            'device_power' => $devicePower,
            'rack_count' => count($comparisons),
            'comparisons' => $comparisons,
        ];
    }

    private function calculateRackSuitabilityScore(Rack $rack, int $deviceHeight, int $devicePower): int
    {
        $score = 50;

        $currentPower = $rack->devices->sum('power');
        if ($rack->power > 0) {
            $powerRatio = ($currentPower + $devicePower) / $rack->power;
            if ($powerRatio <= 0.7) {
                $score += 20;
            } elseif ($powerRatio <= 0.85) {
                $score += 10;
            } elseif ($powerRatio > 0.9) {
                $score -= 20;
            }
        } else {
            $score += 10;
        }

        $freeSlots = $this->findFreeGaps($rack);
        $canFit = false;
        $smallestFitSize = PHP_INT_MAX;

        foreach ($freeSlots as $gap) {
            if ($gap['size'] >= $deviceHeight) {
                $canFit = true;
                $smallestFitSize = min($smallestFitSize, $gap['size']);
            }
        }

        if ($canFit) {
            $score += 15;
            if ($smallestFitSize <= $deviceHeight + 2) {
                $score += 10;
            }
        }

        $utilization = $rack->u_count > 0
            ? (count($rack->devices) * 2) / $rack->u_count
            : 0;

        if ($utilization < 0.5) {
            $score += 10;
        } elseif ($utilization > 0.8) {
            $score -= 10;
        }

        return $score;
    }

    public function smartDeviceRecommendation(array $params): array
    {
        $deviceHeight = $params['device_height'] ?? 1;
        $devicePower = $params['device_power'] ?? 0;
        $deviceType = $params['device_type'] ?? 'server';
        $deviceLibraryId = $params['device_library_id'] ?? null;
        $preferredRoomId = $params['preferred_room_id'] ?? null;
        $preferredRackId = $params['preferred_rack_id'] ?? null;

        if ($deviceLibraryId) {
            $library = DeviceLibrary::find($deviceLibraryId);
            if ($library) {
                $deviceHeight = $library->u_height;
                $devicePower = $library->power ?? $devicePower;
                $deviceType = $library->category ?? $deviceType;
            }
        }

        $query = Rack::with(['devices.deviceLibrary', 'rackType', 'room']);
        if ($preferredRoomId) {
            $query->where('room_id', $preferredRoomId);
        }
        if ($preferredRackId) {
            $query->where('id', $preferredRackId);
        }
        $racks = $query->get();

        $roomHeatmap = $this->buildRoomHeatmap($racks);
        $coolingPaths = $this->analyzeCoolingPaths($racks);

        $allRecommendations = [];

        foreach ($racks as $rack) {
            $rackAnalysis = $this->analyzeRackForSmartPlacement($rack, $deviceHeight, $devicePower, $deviceType, $roomHeatmap, $coolingPaths);
            if ($rackAnalysis['can_accommodate']) {
                $allRecommendations[] = $rackAnalysis;
            }
        }

        usort($allRecommendations, fn ($a, $b) => $b['overall_score'] <=> $a['overall_score']);

        $topRecommendations = array_slice($allRecommendations, 0, 10);

        $groupedByRoom = [];
        foreach ($topRecommendations as $rec) {
            $roomName = $rec['room_name'];
            if (!isset($groupedByRoom[$roomName])) {
                $groupedByRoom[$roomName] = [];
            }
            $groupedByRoom[$roomName][] = $rec;
        }

        return [
            'input_params' => [
                'device_height' => $deviceHeight,
                'device_power' => $devicePower,
                'device_type' => $deviceType,
                'device_library_id' => $deviceLibraryId,
                'preferred_room_id' => $preferredRoomId,
                'preferred_rack_id' => $preferredRackId,
            ],
            'total_candidates' => count($allRecommendations),
            'top_recommendations' => $topRecommendations,
            'grouped_by_room' => $groupedByRoom,
            'heat_effect_warning' => $this->checkHeatEffectWarning($allRecommendations, $devicePower),
        ];
    }

    private function buildRoomHeatmap(Collection $racks): array
    {
        $heatmap = [];

        foreach ($racks as $rack) {
            $rackPowerDensity = $rack->u_count > 0
                ? ($rack->devices->sum('power') / $rack->u_count)
                : 0;

            $zoneSize = 7;
            $rackZones = [];

            for ($zone = 0; $zone < ceil($rack->u_count / $zoneSize); $zone++) {
                $zoneStart = $zone * $zoneSize + 1;
                $zoneEnd = min(($zone + 1) * $zoneSize, $rack->u_count);

                $zonePower = 0;
                $zoneDeviceCount = 0;

                foreach ($rack->devices as $device) {
                    $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
                    $deviceEnd = $device->u_position + $deviceHeight - 1;

                    if ($deviceEnd >= $zoneStart && $device->u_position <= $zoneEnd) {
                        $zonePower += $device->power ?? 0;
                        $zoneDeviceCount++;
                    }
                }

                $zoneUCount = $zoneEnd - $zoneStart + 1;
                $rackZones[$zone + 1] = [
                    'power_density' => $zoneUCount > 0 ? $zonePower / $zoneUCount : 0,
                    'device_count' => $zoneDeviceCount,
                    'heat_level' => $this->calculateHeatLevel($zonePower, $zoneUCount),
                ];
            }

            $heatmap[$rack->id] = [
                'rack_power_density' => $rackPowerDensity,
                'zones' => $rackZones,
            ];
        }

        return $heatmap;
    }

    private function calculateHeatLevel(float $power, int $uCount): string
    {
        if ($uCount == 0) {
            return 'cold';
        }

        $avgPowerPerU = $power / $uCount;

        if ($avgPowerPerU < 2) {
            return 'cold';
        } elseif ($avgPowerPerU < 5) {
            return 'normal';
        } elseif ($avgPowerPerU < 8) {
            return 'warm';
        } else {
            return 'hot';
        }
    }

    private function analyzeCoolingPaths(Collection $racks): array
    {
        $paths = [];

        foreach ($racks as $rack) {
            $rackCooling = [
                'rack_id' => $rack->id,
                'cooling_type' => $rack->cooling_type ?? 'front_to_back',
                'efficiency_zones' => [],
            ];

            $zoneSize = 7;
            for ($zone = 0; $zone < ceil($rack->u_count / $zoneSize); $zone++) {
                $zoneStart = $zone * $zoneSize + 1;
                $zoneEnd = min(($zone + 1) * $zoneSize, $rack->u_count);

                $blockedAbove = false;
                $blockedBelow = false;

                foreach ($rack->devices as $device) {
                    $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
                    $deviceEnd = $device->u_position + $deviceHeight - 1;

                    if ($deviceEnd >= $zoneStart && $device->u_position <= $zoneEnd) {
                        if ($deviceEnd >= $zoneStart && $deviceEnd < $zoneEnd) {
                            $blockedAbove = true;
                        }
                        if ($device->u_position > $zoneStart && $device->u_position <= $zoneEnd) {
                            $blockedBelow = true;
                        }
                    }
                }

                $rackCooling['efficiency_zones'][$zone + 1] = [
                    'airflow_obstructed' => $blockedAbove || $blockedBelow,
                    'cooling_efficiency' => ($blockedAbove || $blockedBelow) ? 'reduced' : 'optimal',
                ];
            }

            $paths[$rack->id] = $rackCooling;
        }

        return $paths;
    }

    private function analyzeRackForSmartPlacement(Rack $rack, int $deviceHeight, int $devicePower, string $deviceType, array $roomHeatmap, array $coolingPaths): array
    {
        $currentPower = $rack->devices->sum('power');
        $powerOk = ($rack->power == 0) || ($currentPower + $devicePower <= $rack->power);

        $freeSlots = $this->findFreeGaps($rack);
        $canFit = false;
        $bestSlots = [];

        foreach ($freeSlots as $gap) {
            if ($gap['size'] >= $deviceHeight) {
                $canFit = true;
                for ($u = $gap['start']; $u <= $gap['end'] - $deviceHeight + 1; $u++) {
                    $bestSlots[] = $u;
                }
            }
        }

        if (!$canFit || !$powerOk) {
            return [
                'rack_id' => $rack->id,
                'rack_name' => $rack->name,
                'room_name' => $rack->room?->name,
                'can_accommodate' => false,
                'reason' => !$canFit ? '空间不足' : '电源容量不足',
            ];
        }

        $rackScores = [];
        foreach ($bestSlots as $uPosition) {
            $slotScore = $this->calculateSlotScore($rack, $uPosition, $deviceHeight, $devicePower, $deviceType, $roomHeatmap, $coolingPaths);
            $slotScore['u_position'] = $uPosition;
            $rackScores[] = $slotScore;
        }

        usort($rackScores, fn ($a, $b) => $b['overall_score'] <=> $a['overall_score']);
        $bestSlot = $rackScores[0];

        $typeCompatibility = $this->analyzeTypeCompatibility($rack, $deviceType);
        $powerBalance = $this->analyzePowerBalanceAfterPlacement($rack, $bestSlot['u_position'], $deviceHeight, $devicePower);

        $overallScore =
            $bestSlot['overall_score'] * 0.40 +
            $typeCompatibility['score'] * 0.25 +
            $powerBalance['score'] * 0.20 +
            ($rack->power > 0 ? (1 - ($currentPower + $devicePower) / $rack->power) * 20 : 10) * 0.15;

        return [
            'rack_id' => $rack->id,
            'rack_name' => $rack->name,
            'room_name' => $rack->room?->name,
            'room_id' => $rack->room_id,
            'can_accommodate' => true,
            'recommended_u_position' => $bestSlot['u_position'],
            'recommended_u_end' => $bestSlot['u_position'] + $deviceHeight - 1,
            'overall_score' => round($overallScore, 1),
            'score_breakdown' => [
                'slot_score' => round($bestSlot['overall_score'], 1),
                'type_compatibility' => round($typeCompatibility['score'], 1),
                'power_balance' => round($powerBalance['score'], 1),
                'power_headroom' => round(($rack->power > 0 ? (1 - ($currentPower + $devicePower) / $rack->power) * 20 : 10), 1),
            ],
            'reasons' => array_merge($bestSlot['reasons'], $typeCompatibility['reasons'], $powerBalance['reasons']),
            'warnings' => $this->generateWarnings($rack, $bestSlot['u_position'], $deviceHeight, $devicePower, $roomHeatmap, $coolingPaths),
            'heat_map' => $roomHeatmap[$rack->id] ?? [],
            'cooling_analysis' => $coolingPaths[$rack->id] ?? [],
        ];
    }

    private function calculateSlotScore(Rack $rack, int $startU, int $height, float $devicePower, string $deviceType, array $roomHeatmap, array $coolingPaths): array
    {
        $score = 100;
        $reasons = [];

        $zoneSize = 7;
        $slotZone = intdiv($startU - 1, $zoneSize) + 1;

        if (isset($roomHeatmap[$rack->id]['zones'][$slotZone])) {
            $zoneHeat = $roomHeatmap[$rack->id]['zones'][$slotZone]['heat_level'];
            if ($zoneHeat === 'cold') {
                $score += 20;
                $reasons[] = '该区域温度较低，散热条件优越';
            } elseif ($zoneHeat === 'normal') {
                $score += 10;
                $reasons[] = '该区域温度正常，散热条件良好';
            } elseif ($zoneHeat === 'warm') {
                $score -= 10;
                $reasons[] = '该区域温度较高，建议关注散热';
            } elseif ($zoneHeat === 'hot') {
                $score -= 25;
                $reasons[] = '该区域温度过高，不建议放置';
            }
        }

        if (isset($coolingPaths[$rack->id]['efficiency_zones'][$slotZone])) {
            $coolingEfficiency = $coolingPaths[$rack->id]['efficiency_zones'][$slotZone]['cooling_efficiency'];
            if ($coolingEfficiency === 'optimal') {
                $score += 15;
                $reasons[] = '气流通道畅通，冷却效率最佳';
            } else {
                $score -= 15;
                $reasons[] = '气流通道受阻，冷却效率下降';
            }
        }

        $occupiedRanges = $this->getOccupiedRanges($rack);
        $nearbyDevices = $this->findNearbyDevices($occupiedRanges, $startU, $height);
        $distanceScore = $this->calculateDistanceScore($nearbyDevices, $startU, $height);
        $score += $distanceScore;
        if ($distanceScore > 10) {
            $reasons[] = '与相邻设备保持安全散热距离';
        }

        if ($this->isTopHeavyPlacement($rack, $startU, $height)) {
            $score -= 10;
            $reasons[] = '高位放置可能影响机柜重心和散热';
        }

        $weightScore = $this->calculateWeightBalanceScore($rack, $startU, $height);
        $score += $weightScore;
        if ($weightScore > 0) {
            $reasons[] = '符合机柜重量平衡原则';
        }

        $deviceCount = count($rack->devices);
        $emptyRatio = ($rack->u_count - $deviceCount) / $rack->u_count;
        if ($emptyRatio > 0.7) {
            $score += 10;
            $reasons[] = '机柜空闲率较高，扩展性强';
        }

        return [
            'overall_score' => max(0, $score),
            'reasons' => $reasons,
        ];
    }

    private function analyzeTypeCompatibility(Rack $rack, string $deviceType): array
    {
        $existingTypes = $rack->devices->pluck('category')->filter()->unique()->toArray();

        $compatibilityRules = [
            'server' => ['switch', 'storage', 'server'],
            'switch' => ['server', 'switch', 'router'],
            'storage' => ['server', 'storage'],
            'router' => ['switch', 'router', 'firewall'],
            'firewall' => ['router', 'switch'],
        ];

        $compatibleTypes = $compatibilityRules[$deviceType] ?? ['server', 'switch', 'storage', 'router', 'firewall'];

        $matchingTypes = array_intersect($existingTypes, $compatibleTypes);
        $matchingCount = count($matchingTypes);

        if (empty($existingTypes)) {
            return [
                'score' => 80,
                'reasons' => ['空机柜，兼容任何类型设备'],
            ];
        }

        if ($matchingCount > 0) {
            $score = 70 + ($matchingCount * 10);
            return [
                'score' => min(100, $score),
                'reasons' => ["与现有设备类型兼容（" . implode(', ', $matchingTypes) . "）"],
            ];
        }

        return [
            'score' => 50,
            'reasons' => ['与现有设备类型不同，建议确认连接需求'],
        ];
    }

    private function analyzePowerBalanceAfterPlacement(Rack $rack, int $startU, int $height, float $devicePower): array
    {
        $rackCenter = $rack->u_count / 2;
        $newDeviceCenter = $startU + ($height - 1) / 2;

        $upperPower = 0;
        $lowerPower = 0;
        $centerPower = 0;

        foreach ($rack->devices as $device) {
            $deviceHeight = $device->deviceLibrary?->u_height ?? 1;
            $deviceCenter = $device->u_position + ($deviceHeight - 1) / 2;
            $power = $device->power ?? 0;

            if ($deviceCenter < $rackCenter - 5) {
                $lowerPower += $power;
            } elseif ($deviceCenter > $rackCenter + 5) {
                $upperPower += $power;
            } else {
                $centerPower += $power;
            }
        }

        if ($newDeviceCenter < $rackCenter - 5) {
            $lowerPower += $devicePower;
        } elseif ($newDeviceCenter > $rackCenter + 5) {
            $upperPower += $devicePower;
        } else {
            $centerPower += $devicePower;
        }

        $totalPower = $upperPower + $lowerPower + $centerPower;
        if ($totalPower == 0) {
            return [
                'score' => 100,
                'reasons' => ['新设备将使电源分布均衡'],
            ];
        }

        $upperRatio = $upperPower / $totalPower;
        $lowerRatio = $lowerPower / $totalPower;
        $balanceDiff = abs($upperRatio - $lowerRatio);

        if ($balanceDiff < 0.1) {
            return [
                'score' => 100,
                'reasons' => ['电源负载分布非常均衡'],
            ];
        } elseif ($balanceDiff < 0.2) {
            return [
                'score' => 80,
                'reasons' => ['电源负载分布基本均衡'],
            ];
        } elseif ($balanceDiff < 0.3) {
            return [
                'score' => 60,
                'reasons' => ['电源负载分布略显不均'],
            ];
        } else {
            return [
                'score' => 40,
                'reasons' => ['电源负载分布不均，建议调整位置'],
            ];
        }
    }

    private function generateWarnings(Rack $rack, int $startU, int $height, float $devicePower, array $roomHeatmap, array $coolingPaths): array
    {
        $warnings = [];

        $currentPower = $rack->devices->sum('power');
        if ($rack->power > 0) {
            $powerAfter = $currentPower + $devicePower;
            $powerRatio = $powerAfter / $rack->power;

            if ($powerRatio > 0.9) {
                $warnings[] = [
                    'type' => 'danger',
                    'message' => "电源负载将达到 {$powerAfter}W，占额定功率的 " . round($powerRatio * 100, 1) . "%，接近上限",
                ];
            } elseif ($powerRatio > 0.8) {
                $warnings[] = [
                    'type' => 'warning',
                    'message' => "电源负载将达到 {$powerAfter}W，占额定功率的 " . round($powerRatio * 100, 1) . "%，建议关注",
                ];
            }
        }

        $zoneSize = 7;
        $slotZone = intdiv($startU - 1, $zoneSize) + 1;

        if (isset($roomHeatmap[$rack->id]['zones'][$slotZone])) {
            $zoneHeat = $roomHeatmap[$rack->id]['zones'][$slotZone]['heat_level'];
            if ($zoneHeat === 'hot') {
                $warnings[] = [
                    'type' => 'danger',
                    'message' => '该区域温度过高，放置高功率设备可能加剧过热风险',
                ];
            }
        }

        if (isset($coolingPaths[$rack->id]['efficiency_zones'][$slotZone])) {
            if ($coolingPaths[$rack->id]['efficiency_zones'][$slotZone]['airflow_obstructed']) {
                $warnings[] = [
                    'type' => 'warning',
                    'message' => '该位置气流通道受阻，建议重新评估散热方案',
                ];
            }
        }

        if ($startU + $height - 1 > $rack->u_count - 2) {
            $warnings[] = [
                'type' => 'info',
                'message' => '设备靠近机柜顶部，可能影响顶部散热',
            ];
        }

        return $warnings;
    }

    private function checkHeatEffectWarning(array $recommendations, float $devicePower): ?array
    {
        if (empty($recommendations)) {
            return [
                'type' => 'warning',
                'message' => '没有符合条件的机柜，可能需要扩容或调整现有设备',
            ];
        }

        $topRec = $recommendations[0];
        if (($topRec['overall_score'] ?? 0) < 50) {
            return [
                'type' => 'warning',
                'message' => '最佳推荐位置评分较低，建议考虑调整设备参数或扩容',
            ];
        }

        return null;
    }
}
