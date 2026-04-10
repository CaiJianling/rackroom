<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-04-10 10:00:00
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-04-10 10:00:00
 * @FilePath: /rackroom/app/Http/Controllers/BackupController.php
 * @Description: 数据备份与恢复控制器
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
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    private string $backupPath = 'backups';

    /**
     * 显示备份管理页面
     */
    public function index(): Response
    {
        $backups = $this->getBackupList();

        return Inertia::render('Backup/Index', [
            'backups' => $backups,
        ]);
    }

    /**
     * 获取备份列表
     */
    private function getBackupList(): array
    {
        $backups = [];
        $files = Storage::files($this->backupPath);

        foreach ($files as $file) {
            if (str_ends_with($file, '.json')) {
                $backups[] = [
                    'id' => basename($file, '.json'),
                    'filename' => basename($file),
                    'size' => $this->formatSize(Storage::size($file)),
                    'size_bytes' => Storage::size($file),
                    'created_at' => date('Y-m-d H:i:s', Storage::lastModified($file)),
                ];
            }
        }

        // 按创建时间倒序
        usort($backups, fn ($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));

        return $backups;
    }

    /**
     * 格式化文件大小
     */
    private function formatSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $unitIndex = 0;

        while ($bytes >= 1024 && $unitIndex < count($units) - 1) {
            $bytes /= 1024;
            $unitIndex++;
        }

        return round($bytes, 2).' '.$units[$unitIndex];
    }

    /**
     * 创建备份
     */
    public function create(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:100',
        ]);

        try {
            // 确保备份目录存在
            if (! Storage::exists($this->backupPath)) {
                Storage::makeDirectory($this->backupPath);
            }

            $data = [
                'version' => '1.0',
                'exported_at' => now()->toIso8601String(),
                'name' => $request->input('name'),
                'rooms' => Room::all()->toArray(),
                'rack_types' => RackType::all()->toArray(),
                'racks' => Rack::all()->toArray(),
                'device_types' => DeviceType::all()->toArray(),
                'device_library' => DeviceLibrary::all()->toArray(),
                'devices' => Device::all()->toArray(),
            ];

            $filename = $this->generateBackupFilename($request->input('name'));
            $filepath = $this->backupPath.'/'.$filename;

            Storage::put($filepath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return response()->json([
                'success' => true,
                'message' => '备份创建成功',
                'backup' => [
                    'id' => basename($filename, '.json'),
                    'filename' => $filename,
                    'size' => $this->formatSize(Storage::size($filepath)),
                    'size_bytes' => Storage::size($filepath),
                    'created_at' => now()->format('Y-m-d H:i:s'),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => '备份创建失败: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 生成备份文件名
     */
    private function generateBackupFilename(?string $name): string
    {
        $timestamp = now()->format('Y-m-d_H-i-s');
        $suffix = $name ? '_'.preg_replace('/[^a-zA-Z0-9\-_]/', '_', $name) : '';

        return "backup_{$timestamp}{$suffix}.json";
    }

    /**
     * 查看备份详情
     */
    public function show(string $id): JsonResponse
    {
        $filepath = $this->backupPath.'/'.$id.'.json';

        if (! Storage::exists($filepath)) {
            return response()->json([
                'success' => false,
                'message' => '备份文件不存在',
            ], 404);
        }

        try {
            $content = Storage::get($filepath);
            $data = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json([
                    'success' => false,
                    'message' => '备份文件格式错误',
                ], 422);
            }

            $preview = [
                'version' => $data['version'] ?? 'unknown',
                'exported_at' => $data['exported_at'] ?? null,
                'name' => $data['name'] ?? null,
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
            return response()->json([
                'success' => false,
                'message' => '读取备份失败: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 下载备份文件
     */
    public function download(string $id): StreamedResponse|JsonResponse
    {
        $filepath = $this->backupPath.'/'.$id.'.json';

        if (! Storage::exists($filepath)) {
            return response()->json([
                'success' => false,
                'message' => '备份文件不存在',
            ], 404);
        }

        return Storage::download($filepath);
    }

    /**
     * 恢复备份
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'options' => 'required|array',
            'options.rooms' => 'boolean',
            'options.rack_types' => 'boolean',
            'options.racks' => 'boolean',
            'options.device_types' => 'boolean',
            'options.device_library' => 'boolean',
            'options.devices' => 'boolean',
            'mode' => 'required|string|in:replace,append',
        ]);

        $filepath = $this->backupPath.'/'.$id.'.json';

        if (! Storage::exists($filepath)) {
            return response()->json([
                'success' => false,
                'message' => '备份文件不存在',
            ], 404);
        }

        try {
            $content = Storage::get($filepath);
            $data = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json([
                    'success' => false,
                    'message' => '备份文件格式错误',
                ], 422);
            }

            $options = $request->input('options');
            $mode = $request->input('mode');

            DB::beginTransaction();

            $stats = [
                'rooms' => 0,
                'rack_types' => 0,
                'racks' => 0,
                'device_types' => 0,
                'device_library' => 0,
                'devices' => 0,
            ];

            // ID 映射表，用于处理关联关系
            $idMappings = [
                'rooms' => [],
                'rack_types' => [],
                'racks' => [],
                'device_types' => [],
                'device_library' => [],
            ];

            // ========== 覆盖模式：先清空数据 ==========
            if ($mode === 'replace') {
                // 6. 清空设备（最底层）
                if ($options['devices']) {
                    Device::query()->delete();
                }

                // 5. 清空设备库
                if ($options['device_library']) {
                    DeviceLibrary::query()->delete();
                }

                // 4. 清空设备类型
                if ($options['device_types']) {
                    DeviceType::query()->delete();
                }

                // 3. 清空机柜
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
            }

            // ========== 导入数据 ==========

            // 1. 导入机房
            if ($options['rooms'] && ! empty($data['rooms'])) {
                foreach ($data['rooms'] as $roomData) {
                    $oldId = $roomData['id'];
                    unset($roomData['id'], $roomData['created_at'], $roomData['updated_at']);

                    if ($mode === 'append') {
                        // 附加模式：检查是否已存在相同名称的机房
                        $existing = Room::where('name', $roomData['name'])->first();
                        if ($existing) {
                            $idMappings['rooms'][$oldId] = $existing->id;

                            continue;
                        }
                    }

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

                    if ($mode === 'append') {
                        $existing = RackType::where('name', $rackTypeData['name'])->first();
                        if ($existing) {
                            $idMappings['rack_types'][$oldId] = $existing->id;

                            continue;
                        }
                    }

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
                    } elseif ($options['rooms'] && ! isset($idMappings['rooms'][$rackData['room_id'] ?? 0])) {
                        continue;
                    }

                    // 映射 rack_type_id
                    if (isset($rackData['rack_type_id']) && isset($idMappings['rack_types'][$rackData['rack_type_id']])) {
                        $rackData['rack_type_id'] = $idMappings['rack_types'][$rackData['rack_type_id']];
                    } elseif ($options['rack_types'] && ! isset($idMappings['rack_types'][$rackData['rack_type_id'] ?? 0])) {
                        $rackData['rack_type_id'] = null;
                    }

                    if ($mode === 'append') {
                        $existing = Rack::where('name', $rackData['name'])
                            ->where('room_id', $rackData['room_id'])
                            ->first();
                        if ($existing) {
                            $idMappings['racks'][$oldId] = $existing->id;

                            continue;
                        }
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

                    if ($mode === 'append') {
                        $existing = DeviceType::where('name', $deviceTypeData['name'])->first();
                        if ($existing) {
                            $idMappings['device_types'][$oldId] = $existing->id;

                            continue;
                        }
                    }

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
                    } elseif ($options['device_types'] && ! isset($idMappings['device_types'][$libraryData['device_type_id'] ?? 0])) {
                        $libraryData['device_type_id'] = null;
                    }

                    if ($mode === 'append') {
                        $existing = DeviceLibrary::where('name', $libraryData['name'])->first();
                        if ($existing) {
                            $idMappings['device_library'][$oldId] = $existing->id;

                            continue;
                        }
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
                    } elseif ($options['racks'] && ! isset($idMappings['racks'][$deviceData['rack_id'] ?? 0])) {
                        $deviceData['rack_id'] = null;
                    }

                    // 映射 device_library_id
                    if (isset($deviceData['device_library_id']) && isset($idMappings['device_library'][$deviceData['device_library_id']])) {
                        $deviceData['device_library_id'] = $idMappings['device_library'][$deviceData['device_library_id']];
                    } elseif ($options['device_library'] && ! isset($idMappings['device_library'][$deviceData['device_library_id'] ?? 0])) {
                        $deviceData['device_library_id'] = null;
                    }

                    Device::create($deviceData);
                    $stats['devices']++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $mode === 'replace' ? '数据恢复成功（覆盖模式）' : '数据恢复成功（附加模式）',
                'stats' => $stats,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => '恢复失败: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 删除备份
     */
    public function destroy(string $id): JsonResponse
    {
        $filepath = $this->backupPath.'/'.$id.'.json';

        if (! Storage::exists($filepath)) {
            return response()->json([
                'success' => false,
                'message' => '备份文件不存在',
            ], 404);
        }

        try {
            Storage::delete($filepath);

            return response()->json([
                'success' => true,
                'message' => '备份删除成功',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => '删除失败: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 上传并导入备份
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:json|max:10240',
            'save_to_server' => 'nullable|string|in:true,false,1,0',
        ]);

        try {
            $file = $request->file('file');
            $content = file_get_contents($file->getRealPath());
            $data = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json([
                    'success' => false,
                    'message' => '无效的JSON文件',
                ], 422);
            }

            // 如果需要保存到服务器
            $saveToServer = in_array($request->input('save_to_server'), ['true', '1'], true);
            if ($saveToServer) {
                if (! Storage::exists($this->backupPath)) {
                    Storage::makeDirectory($this->backupPath);
                }

                $filename = $this->generateBackupFilename($data['name'] ?? null);
                $filepath = $this->backupPath.'/'.$filename;
                Storage::put($filepath, $content);

                return response()->json([
                    'success' => true,
                    'message' => '备份上传并保存成功',
                    'backup' => [
                        'id' => basename($filename, '.json'),
                        'filename' => $filename,
                        'size' => $this->formatSize(Storage::size($filepath)),
                        'created_at' => now()->format('Y-m-d H:i:s'),
                    ],
                    'preview' => [
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
                    ],
                ]);
            }

            // 仅返回预览数据
            return response()->json([
                'success' => true,
                'message' => '文件解析成功',
                'preview' => [
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
                ],
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => '上传失败: '.$e->getMessage(),
            ], 500);
        }
    }
}
