<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-04-09 10:00:00
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-04-09 10:00:00
 * @FilePath: /rackroom/app/Http/Controllers/DataExportController.php
 * @Description: 数据导出导入控制器
 */

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use App\Models\RackType;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataExportController extends Controller
{
    /**
     * 导出所有数据
     */
    public function export(): StreamedResponse
    {
        $data = [
            'version' => '1.0',
            'exported_at' => now()->toIso8601String(),
            'rooms' => Room::all()->toArray(),
            'rack_types' => RackType::all()->toArray(),
            'racks' => Rack::all()->toArray(),
            'device_types' => DeviceType::all()->toArray(),
            'device_library' => DeviceLibrary::all()->toArray(),
            'devices' => Device::all()->toArray(),
        ];

        $filename = 'rackroom_backup_'.now()->format('Y-m-d_H-i-s').'.json';

        return response()->streamDownload(function () use ($data) {
            echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json',
        ]);
    }

    /**
     * 预览导入数据
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:json|max:10240',
        ]);

        try {
            $content = file_get_contents($request->file('file')->getRealPath());
            $data = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json(['error' => '无效的JSON文件'], 422);
            }

            $preview = [
                'version' => $data['version'] ?? 'unknown',
                'exported_at' => $data['exported_at'] ?? null,
                'counts' => [
                    'rooms' => count($data['rooms'] ?? []),
                    'rack_types' => count($data['rack_types'] ?? []),
                    'racks' => count($data['racks'] ?? []),
                    'device_types' => count($data['device_types'] ?? []),
                    'device_library' => count($data['device_library'] ?? []),
                    'devices' => count($data['devices'] ?? []),
                ],
            ];

            return response()->json([
                'success' => true,
                'preview' => $preview,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => '文件解析失败: '.$e->getMessage()], 422);
        }
    }

    /**
     * 导入数据（覆盖模式）
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'data' => 'required|array',
            'options' => 'required|array',
            'options.rooms' => 'boolean',
            'options.rack_types' => 'boolean',
            'options.racks' => 'boolean',
            'options.device_types' => 'boolean',
            'options.device_library' => 'boolean',
            'options.devices' => 'boolean',
        ]);

        $data = $request->input('data');
        $options = $request->input('options');

        DB::beginTransaction();

        try {
            $stats = [
                'rooms' => 0,
                'rack_types' => 0,
                'racks' => 0,
                'device_types' => 0,
                'device_library' => 0,
                'devices' => 0,
            ];

            // ========== 覆盖模式：先清空数据（按依赖顺序删除） ==========

            // 6. 清空设备（最底层，依赖 racks 和 device_library）
            if ($options['devices']) {
                Device::query()->delete();
            }

            // 5. 清空设备库（依赖 device_types）
            if ($options['device_library']) {
                DeviceLibrary::query()->delete();
            }

            // 4. 清空设备类型
            if ($options['device_types']) {
                DeviceType::query()->delete();
            }

            // 3. 清空机柜（依赖 rooms 和 rack_types）
            if ($options['racks']) {
                Rack::query()->delete();
            }

            // 2. 清空机柜类型
            if ($options['rack_types']) {
                RackType::query()->delete();
            }

            // 1. 清空机房（最顶层）
            if ($options['rooms']) {
                Room::query()->delete();
            }

            // ID 映射表，用于处理关联关系
            $idMappings = [
                'rooms' => [],
                'rack_types' => [],
                'racks' => [],
                'device_types' => [],
                'device_library' => [],
            ];

            // ========== 按相反顺序导入新数据 ==========

            // 1. 导入机房
            if ($options['rooms'] && ! empty($data['rooms'])) {
                foreach ($data['rooms'] as $roomData) {
                    $oldId = $roomData['id'];
                    unset($roomData['id'], $roomData['created_at'], $roomData['updated_at']);
                    $room = Room::create($roomData);
                    $idMappings['rooms'][$oldId] = $room->id;
                    $stats['rooms']++;
                }
            }

            // 2. 导入机柜类型
            if ($options['rack_types'] && ! empty($data['rack_types'])) {
                foreach ($data['rack_types'] as $rackTypeData) {
                    $oldId = $rackTypeData['id'];
                    unset($rackTypeData['id'], $rackTypeData['created_at'], $rackTypeData['updated_at']);
                    $rackType = RackType::create($rackTypeData);
                    $idMappings['rack_types'][$oldId] = $rackType->id;
                    $stats['rack_types']++;
                }
            }

            // 3. 导入机柜
            if ($options['racks'] && ! empty($data['racks'])) {
                foreach ($data['racks'] as $rackData) {
                    $oldId = $rackData['id'];
                    unset($rackData['id'], $rackData['created_at'], $rackData['updated_at']);

                    // 映射 room_id
                    if (isset($rackData['room_id']) && isset($idMappings['rooms'][$rackData['room_id']])) {
                        $rackData['room_id'] = $idMappings['rooms'][$rackData['room_id']];
                    } elseif ($options['rooms']) {
                        // 如果导入了机房但没找到映射，跳过
                        continue;
                    }

                    // 映射 rack_type_id
                    if (isset($rackData['rack_type_id']) && isset($idMappings['rack_types'][$rackData['rack_type_id']])) {
                        $rackTypeId = $idMappings['rack_types'][$rackData['rack_type_id']];
                        $rackData['rack_type_id'] = $rackTypeId;
                    } elseif ($options['rack_types']) {
                        $rackData['rack_type_id'] = null;
                    }

                    $rack = Rack::create($rackData);
                    $idMappings['racks'][$oldId] = $rack->id;
                    $stats['racks']++;
                }
            }

            // 4. 导入设备类型
            if ($options['device_types'] && ! empty($data['device_types'])) {
                foreach ($data['device_types'] as $deviceTypeData) {
                    $oldId = $deviceTypeData['id'];
                    unset($deviceTypeData['id'], $deviceTypeData['created_at'], $deviceTypeData['updated_at']);
                    $deviceType = DeviceType::create($deviceTypeData);
                    $idMappings['device_types'][$oldId] = $deviceType->id;
                    $stats['device_types']++;
                }
            }

            // 5. 导入设备库
            if ($options['device_library'] && ! empty($data['device_library'])) {
                foreach ($data['device_library'] as $libraryData) {
                    $oldId = $libraryData['id'];
                    unset($libraryData['id'], $libraryData['created_at'], $libraryData['updated_at']);

                    // 映射 device_type_id
                    if (isset($libraryData['device_type_id']) && isset($idMappings['device_types'][$libraryData['device_type_id']])) {
                        $libraryData['device_type_id'] = $idMappings['device_types'][$libraryData['device_type_id']];
                    } elseif ($options['device_types']) {
                        $libraryData['device_type_id'] = null;
                    }

                    $library = DeviceLibrary::create($libraryData);
                    $idMappings['device_library'][$oldId] = $library->id;
                    $stats['device_library']++;
                }
            }

            // 6. 导入设备
            if ($options['devices'] && ! empty($data['devices'])) {
                foreach ($data['devices'] as $deviceData) {
                    unset($deviceData['id'], $deviceData['created_at'], $deviceData['updated_at']);

                    // 映射 rack_id
                    if (isset($deviceData['rack_id']) && isset($idMappings['racks'][$deviceData['rack_id']])) {
                        $deviceData['rack_id'] = $idMappings['racks'][$deviceData['rack_id']];
                    } elseif ($options['racks']) {
                        $deviceData['rack_id'] = null;
                    }

                    // 映射 device_library_id
                    if (isset($deviceData['device_library_id']) && isset($idMappings['device_library'][$deviceData['device_library_id']])) {
                        $deviceData['device_library_id'] = $idMappings['device_library'][$deviceData['device_library_id']];
                    } elseif ($options['device_library']) {
                        $deviceData['device_library_id'] = null;
                    }

                    Device::create($deviceData);
                    $stats['devices']++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '数据导入成功',
                'stats' => $stats,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'error' => '导入失败: '.$e->getMessage(),
            ], 500);
        }
    }
}
