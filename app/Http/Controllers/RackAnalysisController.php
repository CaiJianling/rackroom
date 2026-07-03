<?php

namespace App\Http\Controllers;

use App\Services\CapacityPlanningService;
use App\Services\DeviceHealthAnalysisService;
use App\Services\PowerCapacityService;
use App\Services\RackSpaceRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RackAnalysisController extends Controller
{
    public function __construct(
        private RackSpaceRecommendationService $rackSpaceService,
        private PowerCapacityService $powerService,
        private DeviceHealthAnalysisService $healthService,
        private CapacityPlanningService $capacityService
    ) {}

    public function recommendPosition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
            'device_height' => 'required|integer|min:1|max:42',
            'device_library_id' => 'nullable|integer|exists:device_library,id',
        ]);

        $result = $this->rackSpaceService->recommendUPosition(
            $validated['rack_id'],
            $validated['device_height'],
            $validated['device_library_id'] ?? null
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function smartRecommend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_height' => 'nullable|integer|min:1|max:42',
            'device_power' => 'nullable|integer|min:0',
            'device_type' => 'nullable|string|in:server,switch,storage,router,firewall',
            'device_library_id' => 'nullable|integer|exists:device_library,id',
            'preferred_room_id' => 'nullable|integer|exists:rooms,id',
            'preferred_rack_id' => 'nullable|integer|exists:racks,id',
        ]);

        $params = [
            'device_height' => $validated['device_height'] ?? 1,
            'device_power' => $validated['device_power'] ?? 0,
            'device_type' => $validated['device_type'] ?? 'server',
            'device_library_id' => $validated['device_library_id'] ?? null,
            'preferred_room_id' => $validated['preferred_room_id'] ?? null,
            'preferred_rack_id' => $validated['preferred_rack_id'] ?? null,
        ];

        $result = $this->rackSpaceService->smartDeviceRecommendation($params);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function analyzeSpace(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
        ]);

        $result = $this->rackSpaceService->analyzeRackSpaceUtilization($validated['rack_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function compareRacks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_height' => 'required|integer|min:1|max:42',
            'device_power' => 'required|integer|min:0',
            'rack_ids' => 'nullable|array',
            'rack_ids.*' => 'integer|exists:racks,id',
        ]);

        $result = $this->rackSpaceService->compareRacksForDevice(
            $validated['device_height'],
            $validated['device_power'],
            $validated['rack_ids'] ?? []
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function powerAnalysis(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
        ]);

        $result = $this->powerService->analyzeRackPower($validated['rack_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function roomPowerAnalysis(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id' => 'required|integer|exists:rooms,id',
        ]);

        $result = $this->powerService->analyzeRoomPower($validated['room_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function systemPowerOverview(): JsonResponse
    {
        $result = $this->powerService->getSystemPowerOverview();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function powerBalance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
        ]);

        $result = $this->powerService->calculatePowerBalanceScore($validated['rack_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function deviceHealth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => 'required|integer|exists:devices,id',
        ]);

        $result = $this->healthService->analyzeDeviceHealth($validated['device_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function rackHealth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
        ]);

        $result = $this->healthService->analyzeRackHealth($validated['rack_id']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function systemHealthOverview(): JsonResponse
    {
        $result = $this->healthService->getSystemHealthOverview();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function capacityOverview(): JsonResponse
    {
        $result = $this->capacityService->getSystemCapacityOverview();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function rackCapacityTrend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rack_id' => 'required|integer|exists:racks,id',
            'months' => 'nullable|integer|min:3|max:24',
        ]);

        $result = $this->capacityService->getRackCapacityTrend(
            $validated['rack_id'],
            $validated['months'] ?? 6
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function roomCapacityTrend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'room_id' => 'required|integer|exists:rooms,id',
            'months' => 'nullable|integer|min:3|max:24',
        ]);

        $result = $this->capacityService->getRoomCapacityTrend(
            $validated['room_id'],
            $validated['months'] ?? 6
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function capacityWarnings(): JsonResponse
    {
        $result = $this->capacityService->getCapacityWarnings();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function capacityForecast(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'months' => 'nullable|integer|min:3|max:24',
        ]);

        $result = $this->capacityService->getCapacityForecast(
            $validated['months'] ?? 12
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
