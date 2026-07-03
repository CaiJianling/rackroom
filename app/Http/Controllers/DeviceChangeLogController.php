<?php

namespace App\Http\Controllers;

use App\Services\DeviceChangeLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceChangeLogController extends Controller
{
    public function __construct(
        private DeviceChangeLogService $changeLogService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'device_id' => $request->input('device_id'),
            'change_type' => $request->input('change_type'),
            'rack_id' => $request->input('rack_id'),
            'operator_name' => $request->input('operator_name'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
        ];

        $perPage = $request->input('per_page', 20);
        $result = $this->changeLogService->getLogs($filters, $perPage);

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'pagination' => $result['pagination'],
        ]);
    }

    public function deviceHistory(int $deviceId): JsonResponse
    {
        $result = $this->changeLogService->getDeviceHistory($deviceId);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function migrations(Request $request): JsonResponse
    {
        $filters = [
            'from_rack' => $request->input('from_rack'),
            'to_rack' => $request->input('to_rack'),
            'device_name' => $request->input('device_name'),
            'operator' => $request->input('operator'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
        ];

        $perPage = $request->input('per_page', 20);
        $result = $this->changeLogService->getMigrationRecords($filters, $perPage);

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'pagination' => $result['pagination'],
        ]);
    }

    public function statistics(): JsonResponse
    {
        $result = $this->changeLogService->getStatistics();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function changeTypes(): JsonResponse
    {
        $types = $this->changeLogService->getChangeTypeOptions();

        return response()->json([
            'success' => true,
            'data' => $types,
        ]);
    }
}
