<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceChangeLog;
use App\Models\DeviceLibrary;
use App\Models\Rack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class BatchOperationController extends Controller
{
    public function index(Request $request)
    {
        $racks = Rack::with('room')->get();
        $deviceLibrary = DeviceLibrary::with('deviceType')->get();
        $deviceTypes = $deviceLibrary->map(function ($lib) {
            return $lib->deviceType;
        })->filter()->unique('id')->values();

        return inertia('Device/BatchOperations', [
            'racks' => $racks,
            'deviceLibrary' => $deviceLibrary,
            'deviceTypes' => $deviceTypes,
            'breadcrumbs' => [
                ['title' => __('navigation.deviceManagement'), 'href' => '#'],
                ['title' => __('navigation.deviceBatchOperations'), 'href' => '/devices/batch-operations'],
            ],
        ]);
    }

    public function previewImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:20480',
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $handle = fopen($path, 'r');

        $header = fgetcsv($handle);
        if ($header === false) {
            return response()->json([
                'success' => false,
                'message' => 'CSV文件格式错误',
            ], 400);
        }

        $rows = [];
        $errors = [];
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;
            $rowData = $this->parseImportRow($header, $row, $rowNumber);

            if (!empty($rowData['errors'])) {
                foreach ($rowData['errors'] as $error) {
                    $errors[] = $error;
                }
            }

            $rows[] = $rowData['data'];
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'data' => $rows,
            'errors' => $errors,
            'total' => count($rows),
            'error_count' => count($errors),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'devices' => 'required|array',
            'devices.*.name' => 'required|string|max:255',
            'devices.*.rack_id' => 'nullable|integer|exists:racks,id',
            'devices.*.device_library_id' => 'nullable|integer|exists:device_library,id',
            'devices.*.u_position' => 'nullable|integer|min:1|max:100',
            'devices.*.ip_address' => 'nullable|ip',
            'devices.*.status' => 'nullable|in:online,offline,maintenance',
        ]);

        $devices = $request->input('devices');
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => [],
        ];

        foreach ($devices as $index => $deviceData) {
            try {
                $validator = Validator::make($deviceData, [
                    'name' => 'required|string|max:255',
                    'rack_id' => 'nullable|integer|exists:racks,id',
                    'device_library_id' => 'nullable|integer|exists:device_library,id',
                    'u_position' => 'nullable|integer|min:1|max:100',
                    'ip_address' => 'nullable|ip',
                    'status' => 'nullable|in:online,offline,maintenance',
                ]);

                if ($validator->fails()) {
                    $results['failed']++;
                    $results['errors'][] = [
                        'row' => $index + 1,
                        'name' => $deviceData['name'] ?? '未知',
                        'errors' => $validator->errors()->all(),
                    ];
                    continue;
                }

                if (!empty($deviceData['rack_id']) && !empty($deviceData['u_position'])) {
                    $conflict = $this->checkUPositionConflict(
                        $deviceData['rack_id'],
                        $deviceData['u_position'],
                        $deviceData['device_library_id'] ?? null
                    );

                    if ($conflict) {
                        $results['failed']++;
                        $results['errors'][] = [
                            'row' => $index + 1,
                            'name' => $deviceData['name'],
                            'errors' => [$conflict['message']],
                        ];
                        continue;
                    }
                }

                $createData = [
                    'name' => $deviceData['name'],
                    'rack_id' => $deviceData['rack_id'] ?? null,
                    'device_library_id' => $deviceData['device_library_id'] ?? null,
                    'u_position' => $deviceData['u_position'] ?? 1,
                    'ip_address' => $deviceData['ip_address'] ?? null,
                    'status' => $deviceData['status'] ?? 'online',
                    'description' => $deviceData['description'] ?? null,
                ];

                if (!empty($createData['device_library_id'])) {
                    $deviceLibrary = DeviceLibrary::with('deviceType')->find($createData['device_library_id']);
                    if ($deviceLibrary) {
                        $createData['power'] = $deviceLibrary->power;
                        $createData['serial_number'] = $deviceLibrary->serial_number;
                        $createData['model'] = $deviceLibrary->model;
                        $createData['manufacturer'] = $deviceLibrary->manufacturer;
                        if ($deviceLibrary->deviceType) {
                            $createData['category'] = $deviceLibrary->deviceType->name;
                        }
                    }
                } else {
                    $createData['power'] = 0;
                    $createData['category'] = 'other';
                }

                $device = Device::create($createData);
                DeviceChangeLog::logCreate($device);

                $results['success']++;
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'row' => $index + 1,
                    'name' => $deviceData['name'] ?? '未知',
                    'errors' => [$e->getMessage()],
                ];
            }
        }

        return response()->json([
            'success' => $results['failed'] === 0,
            'message' => "导入完成：成功 {$results['success']} 条，失败 {$results['failed']} 条",
            'results' => $results,
        ]);
    }

    public function downloadTemplate(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="device_import_template.csv"',
        ];

        $callback = function () {
            $file = fopen('php://output', 'w');
            fputcsv($file, [
                'name',
                'rack_name',
                'device_library_name',
                'u_position',
                'ip_address',
                'connection_type',
                'connection_port',
                'status',
                'description',
            ]);
            fputcsv($file, [
                '服务器01',
                '机柜A',
                'Dell PowerEdge R740',
                '1',
                '192.168.1.100',
                'ssh',
                '22',
                'online',
                '测试设备',
            ]);
            fputcsv($file, [
                '交换机01',
                '机柜A',
                'Cisco Catalyst 2960',
                '10',
                '192.168.1.101',
                'ssh',
                '22',
                'online',
                '核心交换机',
            ]);
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function previewMigration(Request $request): JsonResponse
    {
        $request->validate([
            'devices' => 'required|array',
            'devices.*.device_id' => 'required|integer|exists:devices,id',
            'devices.*.target_rack_id' => 'required|integer|exists:racks,id',
            'devices.*.target_u_position' => 'required|integer|min:1|max:100',
        ]);

        $devices = $request->input('devices');
        $results = [];
        $errors = [];

        foreach ($devices as $index => $migration) {
            $device = Device::with('rack', 'deviceLibrary')->find($migration['device_id']);
            $targetRack = Rack::find($migration['target_rack_id']);

            if (!$device || !$targetRack) {
                $errors[] = [
                    'row' => $index + 1,
                    'device_name' => $device?->name ?? '未知',
                    'errors' => ['设备或目标机柜不存在'],
                ];
                continue;
            }

            $conflict = $this->checkUPositionConflict(
                $migration['target_rack_id'],
                $migration['target_u_position'],
                $device->device_library_id,
                $device->id
            );

            $deviceLibrary = $device->deviceLibrary;
            $uHeight = $deviceLibrary?->u_height ?? 1;
            $targetUEnd = $migration['target_u_position'] + $uHeight - 1;

            if ($targetUEnd > $targetRack->u_count) {
                $errors[] = [
                    'row' => $index + 1,
                    'device_name' => $device->name,
                    'errors' => ["目标U位 {$migration['target_u_position']}-{$targetUEnd} 超出机柜容量 ({$targetRack->u_count}U)"],
                ];
                continue;
            }

            if ($conflict) {
                $errors[] = [
                    'row' => $index + 1,
                    'device_name' => $device->name,
                    'errors' => [$conflict['message']],
                ];
                continue;
            }

            $results[] = [
                'device_id' => $device->id,
                'device_name' => $device->name,
                'current_rack' => $device->rack?->name ?? '未分配',
                'current_u_position' => $device->u_position,
                'target_rack' => $targetRack->name,
                'target_u_position' => $migration['target_u_position'],
                'u_height' => $uHeight,
            ];
        }

        return response()->json([
            'success' => empty($errors),
            'data' => $results,
            'errors' => $errors,
            'total' => count($results),
            'error_count' => count($errors),
        ]);
    }

    public function migrate(Request $request): JsonResponse
    {
        $request->validate([
            'devices' => 'required|array',
            'devices.*.device_id' => 'required|integer|exists:devices,id',
            'devices.*.target_rack_id' => 'required|integer|exists:racks,id',
            'devices.*.target_u_position' => 'required|integer|min:1|max:100',
        ]);

        $devices = $request->input('devices');
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => [],
        ];

        foreach ($devices as $index => $migration) {
            try {
                $device = Device::with('rack', 'deviceLibrary')->find($migration['device_id']);
                $targetRack = Rack::find($migration['target_rack_id']);

                if (!$device || !$targetRack) {
                    throw new \Exception('设备或目标机柜不存在');
                }

                $oldRackName = $device->rack?->name ?? '未知';
                $oldUPosition = $device->u_position;

                $device->rack_id = $migration['target_rack_id'];
                $device->u_position = $migration['target_u_position'];
                $device->save();

                DeviceChangeLog::logMigration(
                    $device,
                    $oldRackName,
                    $oldUPosition,
                    $targetRack->name,
                    $migration['target_u_position']
                );

                $results['success']++;
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'row' => $index + 1,
                    'device_name' => $device?->name ?? '未知',
                    'errors' => [$e->getMessage()],
                ];
            }
        }

        return response()->json([
            'success' => $results['failed'] === 0,
            'message' => "迁移完成：成功 {$results['success']} 条，失败 {$results['failed']} 条",
            'results' => $results,
        ]);
    }

    public function previewPowerSchedule(Request $request): JsonResponse
    {
        $request->validate([
            'devices' => 'required|array',
            'devices.*.device_id' => 'required|integer|exists:devices,id',
            'devices.*.action' => 'required|in:power_on,power_off',
        ]);

        $devices = $request->input('devices');
        $results = [];
        $errors = [];

        foreach ($devices as $index => $item) {
            $device = Device::with('rack')->find($item['device_id']);

            if (!$device) {
                $errors[] = [
                    'row' => $index + 1,
                    'device_name' => '未知',
                    'errors' => ['设备不存在'],
                ];
                continue;
            }

            if (empty($device->ip_address)) {
                $errors[] = [
                    'row' => $index + 1,
                    'device_name' => $device->name,
                    'errors' => ['设备无IP地址，无法执行上下电操作'],
                ];
                continue;
            }

            $results[] = [
                'device_id' => $device->id,
                'device_name' => $device->name,
                'ip_address' => $device->ip_address,
                'rack_name' => $device->rack?->name ?? '未分配',
                'current_status' => $device->status,
                'action' => $item['action'],
                'action_label' => $item['action'] === 'power_on' ? '开机' : '关机',
            ];
        }

        return response()->json([
            'success' => empty($errors),
            'data' => $results,
            'errors' => $errors,
            'total' => count($results),
            'error_count' => count($errors),
        ]);
    }

    public function executePowerSchedule(Request $request): JsonResponse
    {
        $request->validate([
            'devices' => 'required|array',
            'devices.*.device_id' => 'required|integer|exists:devices,id',
            'devices.*.action' => 'required|in:power_on,power_off',
        ]);

        $devices = $request->input('devices');
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => [],
        ];

        foreach ($devices as $index => $item) {
            try {
                $device = Device::find($item['device_id']);

                if (!$device) {
                    throw new \Exception('设备不存在');
                }

                $newStatus = $item['action'] === 'power_on' ? 'online' : 'offline';
                $oldStatus = $device->status;

                $device->status = $newStatus;
                $device->save();

                DeviceChangeLog::log(
                    $device,
                    $item['action'],
                    ['status' => $oldStatus],
                    ['status' => $newStatus],
                    $item['action'] === 'power_on' ? '批量开机' : '批量关机'
                );

                $results['success']++;
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'row' => $index + 1,
                    'device_name' => $device?->name ?? '未知',
                    'errors' => [$e->getMessage()],
                ];
            }
        }

        return response()->json([
            'success' => $results['failed'] === 0,
            'message' => "执行完成：成功 {$results['success']} 条，失败 {$results['failed']} 条",
            'results' => $results,
        ]);
    }

    public function getDevicesByRack(Request $request, int $rackId): JsonResponse
    {
        $rack = Rack::find($rackId);
        if (!$rack) {
            return response()->json([
                'success' => false,
                'message' => '机柜不存在',
            ], 404);
        }

        $devices = Device::with('deviceLibrary')
            ->where('rack_id', $rackId)
            ->orderBy('u_position')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $devices,
        ]);
    }

    public function searchDevices(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'nullable|string|max:255',
            'rack_id' => 'nullable|integer|exists:racks,id',
        ]);

        $query = Device::with(['rack', 'deviceLibrary', 'deviceLibrary.deviceType']);

        if ($request->filled('q')) {
            $search = $request->input('q');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('rack_id')) {
            $query->where('rack_id', $request->input('rack_id'));
        }

        $devices = $query->limit(50)->get();

        return response()->json([
            'success' => true,
            'data' => $devices,
        ]);
    }

    private function parseImportRow(array $header, array $row, int $rowNumber): array
    {
        $data = [];
        $errors = [];

        $rowData = array_combine($header, $row);

        $data['row_number'] = $rowNumber;

        if (empty($rowData['name'])) {
            $errors[] = [
                'row' => $rowNumber,
                'field' => 'name',
                'message' => '设备名称不能为空',
            ];
        } else {
            $data['name'] = trim($rowData['name']);
        }

        if (!empty($rowData['rack_name'])) {
            $rack = Rack::where('name', trim($rowData['rack_name']))->first();
            if ($rack) {
                $data['rack_id'] = $rack->id;
                $data['rack_name'] = $rack->name;
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'rack_name',
                    'message' => "机柜「{$rowData['rack_name']}」不存在",
                ];
            }
        }

        if (!empty($rowData['device_library_name'])) {
            $deviceLibrary = DeviceLibrary::where('name', trim($rowData['device_library_name']))->first();
            if ($deviceLibrary) {
                $data['device_library_id'] = $deviceLibrary->id;
                $data['device_library_name'] = $deviceLibrary->name;
                $data['u_height'] = $deviceLibrary->u_height;
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'device_library_name',
                    'message' => "设备库「{$rowData['device_library_name']}」不存在",
                ];
            }
        }

        if (!empty($rowData['u_position'])) {
            $uPosition = intval($rowData['u_position']);
            if ($uPosition < 1 || $uPosition > 100) {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'u_position',
                    'message' => 'U位必须在1-100之间',
                ];
            } else {
                $data['u_position'] = $uPosition;
            }
        } else {
            $data['u_position'] = 1;
        }

        if (!empty($rowData['ip_address'])) {
            if (filter_var(trim($rowData['ip_address']), FILTER_VALIDATE_IP)) {
                $data['ip_address'] = trim($rowData['ip_address']);
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'ip_address',
                    'message' => 'IP地址格式不正确',
                ];
            }
        }

        if (!empty($rowData['connection_type'])) {
            $validTypes = ['ssh', 'rdp', 'vnc', 'radmin'];
            if (in_array(strtolower(trim($rowData['connection_type'])), $validTypes)) {
                $data['connection_type'] = strtolower(trim($rowData['connection_type']));
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'connection_type',
                    'message' => '连接类型必须是 ssh、rdp、vnc 或 radmin',
                ];
            }
        }

        if (!empty($rowData['connection_port'])) {
            $port = intval($rowData['connection_port']);
            if ($port >= 0 && $port <= 65535) {
                $data['connection_port'] = $port;
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'connection_port',
                    'message' => '端口必须在0-65535之间',
                ];
            }
        }

        if (!empty($rowData['status'])) {
            $validStatuses = ['online', 'offline', 'maintenance'];
            if (in_array(strtolower(trim($rowData['status'])), $validStatuses)) {
                $data['status'] = strtolower(trim($rowData['status']));
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'status',
                    'message' => '状态必须是 online、offline 或 maintenance',
                ];
            }
        } else {
            $data['status'] = 'online';
        }

        $data['description'] = !empty($rowData['description']) ? trim($rowData['description']) : null;

        return [
            'data' => $data,
            'errors' => $errors,
        ];
    }

    private function checkUPositionConflict(int $rackId, int $uPosition, ?int $deviceLibraryId, ?int $excludeDeviceId = null): ?array
    {
        $newDeviceHeight = 1;
        if ($deviceLibraryId) {
            $deviceLibrary = DeviceLibrary::find($deviceLibraryId);
            $newDeviceHeight = $deviceLibrary?->u_height ?? 1;
        }

        $newStart = $uPosition;
        $newEnd = $uPosition + $newDeviceHeight - 1;

        $query = Device::with('deviceLibrary')
            ->where('rack_id', $rackId);

        if ($excludeDeviceId) {
            $query->where('id', '!=', $excludeDeviceId);
        }

        $existingDevices = $query->get();

        foreach ($existingDevices as $existingDevice) {
            $existingHeight = $existingDevice->deviceLibrary?->u_height ?? 1;
            $existingStart = $existingDevice->u_position;
            $existingEnd = $existingDevice->u_position + $existingHeight - 1;

            if ($newStart <= $existingEnd && $newEnd >= $existingStart) {
                return [
                    'conflict' => true,
                    'message' => "U位 {$uPosition}-{$newEnd} 与设备「{$existingDevice->name}」占用的 U{$existingStart}-{$existingEnd} 冲突",
                ];
            }
        }

        return null;
    }
}
