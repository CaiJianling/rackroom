<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceDependency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceDependencyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DeviceDependency::with(['sourceDevice', 'targetDevice']);

        if ($request->has('device_id')) {
            $deviceId = $request->input('device_id');
            $query->where(function ($q) use ($deviceId) {
                $q->where('source_device_id', $deviceId)
                    ->orWhere('target_device_id', $deviceId);
            });
        }

        if ($request->has('dependency_type')) {
            $query->where('dependency_type', $request->input('dependency_type'));
        }

        $dependencies = $query->get();

        return response()->json([
            'success' => true,
            'data' => $dependencies,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_device_id' => 'required|integer|exists:devices,id',
            'target_device_id' => 'required|integer|exists:devices,id|different:source_device_id',
            'dependency_type' => 'required|string|in:network,power,storage,application,other',
            'description' => 'nullable|string|max:255',
        ]);

        $exists = DeviceDependency::where('source_device_id', $validated['source_device_id'])
            ->where('target_device_id', $validated['target_device_id'])
            ->where('dependency_type', $validated['dependency_type'])
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => '该设备依赖关系已存在',
            ], 422);
        }

        $dependency = DeviceDependency::create($validated);

        return response()->json([
            'success' => true,
            'data' => $dependency->load(['sourceDevice', 'targetDevice']),
            'message' => '设备依赖关系创建成功',
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $dependency = DeviceDependency::with(['sourceDevice', 'targetDevice'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $dependency,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $dependency = DeviceDependency::findOrFail($id);

        $validated = $request->validate([
            'dependency_type' => 'sometimes|string|in:network,power,storage,application,other',
            'description' => 'nullable|string|max:255',
        ]);

        $dependency->update($validated);

        return response()->json([
            'success' => true,
            'data' => $dependency->load(['sourceDevice', 'targetDevice']),
            'message' => '设备依赖关系更新成功',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $dependency = DeviceDependency::findOrFail($id);
        $dependency->delete();

        return response()->json([
            'success' => true,
            'message' => '设备依赖关系删除成功',
        ]);
    }

    public function topology(Request $request): JsonResponse
    {
        $deviceId = $request->input('device_id');

        if ($deviceId) {
            $dependencies = DeviceDependency::with(['sourceDevice', 'targetDevice'])
                ->where('source_device_id', $deviceId)
                ->orWhere('target_device_id', $deviceId)
                ->get();
        } else {
            $dependencies = DeviceDependency::with(['sourceDevice', 'targetDevice'])->get();
        }

        $nodes = [];
        $edges = [];
        $nodeIds = [];

        foreach ($dependencies as $dep) {
            if (! in_array($dep->source_device_id, $nodeIds)) {
                $nodeIds[] = $dep->source_device_id;
                $nodes[] = [
                    'id' => $dep->source_device_id,
                    'name' => $dep->sourceDevice->name,
                    'type' => $dep->sourceDevice->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'ip' => $dep->sourceDevice->ip_address,
                    'status' => $dep->sourceDevice->status,
                ];
            }

            if (! in_array($dep->target_device_id, $nodeIds)) {
                $nodeIds[] = $dep->target_device_id;
                $nodes[] = [
                    'id' => $dep->target_device_id,
                    'name' => $dep->targetDevice->name,
                    'type' => $dep->targetDevice->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'ip' => $dep->targetDevice->ip_address,
                    'status' => $dep->targetDevice->status,
                ];
            }

            $edges[] = [
                'source' => $dep->source_device_id,
                'target' => $dep->target_device_id,
                'type' => $dep->dependency_type,
                'description' => $dep->description,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'nodes' => $nodes,
                'edges' => $edges,
            ],
        ]);
    }

    public function impactAnalysis(int $deviceId): JsonResponse
    {
        $device = Device::with(['deviceLibrary.deviceType'])->findOrFail($deviceId);

        $directlyAffected = DeviceDependency::with(['targetDevice', 'sourceDevice'])
            ->where('source_device_id', $deviceId)
            ->get()
            ->map(function ($dep) {
                return [
                    'device_id' => $dep->target_device_id,
                    'device_name' => $dep->targetDevice->name,
                    'device_type' => $dep->targetDevice->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'ip_address' => $dep->targetDevice->ip_address,
                    'dependency_type' => $dep->dependency_type,
                    'description' => $dep->description,
                    'level' => 'direct',
                ];
            });

        $directlyAffectedIds = $directlyAffected->pluck('device_id')->toArray();

        $secondLevelAffected = DeviceDependency::with(['targetDevice'])
            ->whereIn('source_device_id', $directlyAffectedIds)
            ->whereNotIn('target_device_id', $directlyAffectedIds)
            ->where('target_device_id', '!=', $deviceId)
            ->get()
            ->map(function ($dep) {
                return [
                    'device_id' => $dep->target_device_id,
                    'device_name' => $dep->targetDevice->name,
                    'device_type' => $dep->targetDevice->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'ip_address' => $dep->targetDevice->ip_address,
                    'dependency_type' => $dep->dependency_type,
                    'description' => $dep->description,
                    'level' => 'indirect',
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'device' => [
                    'id' => $device->id,
                    'name' => $device->name,
                    'type' => $device->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'ip_address' => $device->ip_address,
                    'status' => $device->status,
                ],
                'directly_affected' => $directlyAffected,
                'second_level_affected' => $secondLevelAffected,
                'total_affected' => count($directlyAffected) + count($secondLevelAffected),
            ],
        ]);
    }

    public function getDevices(): JsonResponse
    {
        $devices = Device::with(['deviceLibrary.deviceType', 'rack'])
            ->get()
            ->map(function ($device) {
                return [
                    'id' => $device->id,
                    'name' => $device->name,
                    'ip_address' => $device->ip_address,
                    'status' => $device->status,
                    'type' => $device->deviceLibrary?->deviceType?->name ?? 'unknown',
                    'rack_name' => $device->rack?->name,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $devices,
        ]);
    }
}
