<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceChangeLog;
use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

            if (! empty($rowData['errors'])) {
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

                if (! empty($deviceData['rack_id']) && ! empty($deviceData['u_position'])) {
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

                if (! empty($createData['device_library_id'])) {
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

    public function downloadTemplate(): StreamedResponse
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

            if (! $device || ! $targetRack) {
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

                if (! $device || ! $targetRack) {
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

            if (! $device) {
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

                if (! $device) {
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
        if (! $rack) {
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

        if (! empty($rowData['rack_name'])) {
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

        if (! empty($rowData['device_library_name'])) {
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

        if (! empty($rowData['u_position'])) {
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

        if (! empty($rowData['ip_address'])) {
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

        if (! empty($rowData['connection_type'])) {
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

        if (! empty($rowData['connection_port'])) {
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

        if (! empty($rowData['status'])) {
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

        $data['description'] = ! empty($rowData['description']) ? trim($rowData['description']) : null;

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

    public function downloadXlsxTemplate(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('设备导入模板');

        $headers = ['设备名称*', '机柜名称', '设备库名称', 'U位', 'IP地址', '连接类型', '连接端口', '状态', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [
            ['服务器01', '机柜A', 'Dell PowerEdge R740', '1', '192.168.1.100', 'ssh', '22', 'online', '测试设备'],
            ['交换机01', '机柜A', 'Cisco Catalyst 2960', '10', '192.168.1.101', 'ssh', '22', 'online', '核心交换机'],
        ];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [20, 15, 25, 8, 15, 12, 12, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, 'device_import_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function previewXlsxImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray();

            $header = array_shift($rows);

            $data = [];
            $errors = [];
            $rowNumber = 1;

            foreach ($rows as $row) {
                $rowNumber++;
                $rowData = array_combine($header, $row);
                $parsed = $this->parseImportRow($header, $row, $rowNumber);

                if (! empty($parsed['errors'])) {
                    foreach ($parsed['errors'] as $error) {
                        $errors[] = $error;
                    }
                }

                $data[] = $parsed['data'];
            }

            return response()->json([
                'success' => true,
                'data' => $data,
                'errors' => $errors,
                'total' => count($data),
                'error_count' => count($errors),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => '文件解析失败: '.$e->getMessage(),
            ], 422);
        }
    }

    public function importXlsx(Request $request): JsonResponse
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

        return $this->import($request);
    }

    public function exportAllData(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;

        $this->createRoomsSheet($spreadsheet);
        $this->createRacksSheet($spreadsheet);
        $this->createDevicesSheet($spreadsheet);
        $this->createDeviceLibrarySheet($spreadsheet);
        $this->createDeviceTypesSheet($spreadsheet);

        $filename = 'rackroom_all_data_'.now()->format('Y-m-d_H-i-s').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function createRoomsSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('机房数据');

        $headers = ['机房名称', '位置', '管理员', '温湿度URL', '当前温度', '当前湿度', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        $rooms = Room::all();
        $row = 2;
        foreach ($rooms as $room) {
            $sheet->setCellValue('A'.$row, $room->name);
            $sheet->setCellValue('B'.$row, $room->location ?? '');
            $sheet->setCellValue('C'.$row, $room->manager ?? '');
            $sheet->setCellValue('D'.$row, $room->temp_humidity_url ?? '');
            $sheet->setCellValue('E'.$row, $room->current_temp ?? '');
            $sheet->setCellValue('F'.$row, $room->current_humidity ?? '');
            $sheet->setCellValue('G'.$row, $room->description ?? '');
            $row++;
        }

        $columnWidths = [15, 20, 15, 40, 12, 12, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createRacksSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('机柜数据');

        $headers = ['机房名称', '机柜名称', '机柜类型', 'U数', '功率(W)', '温湿度URL', '当前温度', '当前湿度', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        $racks = Rack::with(['room', 'rackType'])->get();
        $row = 2;
        foreach ($racks as $rack) {
            $sheet->setCellValue('A'.$row, $rack->room?->name ?? '');
            $sheet->setCellValue('B'.$row, $rack->name);
            $sheet->setCellValue('C'.$row, $rack->rackType?->name ?? '');
            $sheet->setCellValue('D'.$row, $rack->u_count);
            $sheet->setCellValue('E'.$row, $rack->power ?? '');
            $sheet->setCellValue('F'.$row, $rack->temp_humidity_url ?? '');
            $sheet->setCellValue('G'.$row, $rack->current_temp ?? '');
            $sheet->setCellValue('H'.$row, $rack->current_humidity ?? '');
            $sheet->setCellValue('I'.$row, $rack->description ?? '');
            $row++;
        }

        $columnWidths = [15, 15, 15, 8, 12, 40, 12, 12, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDevicesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备数据');

        $headers = ['机房名称', '机柜名称', '设备名称', '设备型号', '制造商', '设备类型', 'U位', 'U高度', '功率(W)', '序列号', 'IP地址', '连接类型', '连接端口', '状态', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        $devices = Device::with(['rack.room', 'deviceLibrary.deviceType'])->get();
        $row = 2;
        foreach ($devices as $device) {
            $sheet->setCellValue('A'.$row, $device->rack?->room?->name ?? '');
            $sheet->setCellValue('B'.$row, $device->rack?->name ?? '');
            $sheet->setCellValue('C'.$row, $device->name);
            $sheet->setCellValue('D'.$row, $device->deviceLibrary?->model ?? '');
            $sheet->setCellValue('E'.$row, $device->deviceLibrary?->manufacturer ?? '');
            $sheet->setCellValue('F'.$row, $device->deviceLibrary?->deviceType?->name ?? '');
            $sheet->setCellValue('G'.$row, $device->u_position);
            $sheet->setCellValue('H'.$row, $device->deviceLibrary?->u_height ?? 1);
            $sheet->setCellValue('I'.$row, $device->power ?? ($device->deviceLibrary?->power ?? 0));
            $sheet->setCellValue('J'.$row, $device->serial_number ?? '');
            $sheet->setCellValue('K'.$row, $device->ip_address ?? '');
            $sheet->setCellValue('L'.$row, $device->connection_type ?? '');
            $sheet->setCellValue('M'.$row, $device->connection_port ?? '');
            $sheet->setCellValue('N'.$row, $device->status ?? 'offline');
            $sheet->setCellValue('O'.$row, $device->description ?? '');
            $row++;
        }

        $columnWidths = [15, 15, 20, 20, 15, 15, 8, 8, 10, 20, 15, 12, 12, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDeviceLibrarySheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备库数据');

        $headers = ['设备名称', '型号', '制造商', '设备类型', 'U高度', '功率(W)', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        $libraries = DeviceLibrary::with('deviceType')->get();
        $row = 2;
        foreach ($libraries as $library) {
            $sheet->setCellValue('A'.$row, $library->name);
            $sheet->setCellValue('B'.$row, $library->model);
            $sheet->setCellValue('C'.$row, $library->manufacturer ?? '');
            $sheet->setCellValue('D'.$row, $library->deviceType?->name ?? '');
            $sheet->setCellValue('E'.$row, $library->u_height);
            $sheet->setCellValue('F'.$row, $library->power);
            $sheet->setCellValue('G'.$row, $library->description ?? '');
            $row++;
        }

        $columnWidths = [20, 20, 15, 15, 8, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDeviceTypesSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备类型数据');

        $headers = ['设备类型名称', '图标', '颜色'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        $types = DeviceType::all();
        $row = 2;
        foreach ($types as $type) {
            $sheet->setCellValue('A'.$row, $type->name);
            $sheet->setCellValue('B'.$row, $type->icon ?? '');
            $sheet->setCellValue('C'.$row, $type->color ?? '');
            $row++;
        }

        $columnWidths = [20, 15, 15];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    public function downloadAllImportTemplate(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;

        $this->createRoomsTemplateSheet($spreadsheet);
        $this->createRacksTemplateSheet($spreadsheet);
        $this->createDevicesTemplateSheet($spreadsheet);
        $this->createDeviceLibraryTemplateSheet($spreadsheet);
        $this->createDeviceTypesTemplateSheet($spreadsheet);

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, 'rackroom_all_import_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function createRoomsTemplateSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('机房数据');

        $headers = ['机房名称*', '位置', '管理员', '温湿度URL', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [
            ['机房A', '1号楼1层', '张三', 'https://example.com/temp-room-a', '生产机房'],
            ['机房B', '2号楼2层', '李四', '', '测试机房'],
        ];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [15, 20, 15, 40, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createRacksTemplateSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('机柜数据');

        $headers = ['机房名称*', '机柜名称*', '机柜类型', 'U数', '功率(W)', '温湿度URL', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [
            ['机房A', 'A01', '标准机柜', '42', '3000', '', '生产机柜'],
            ['机房A', 'A02', '标准机柜', '42', '3000', 'https://example.com/temp-rack-a02', '生产机柜'],
        ];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [15, 15, 15, 8, 12, 40, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDevicesTemplateSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备数据');

        $headers = ['机房名称*', '机柜名称*', '设备名称*', '设备型号*', '制造商', '设备类型*', 'U位*', 'U高度', '功率(W)', '序列号', 'IP地址', '连接类型', '连接端口', '状态', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [
            ['机房A', 'A01', '服务器01', 'Dell R740', 'Dell', '服务器', '1', '2', '500', 'SN123456', '192.168.1.10', 'ssh', '22', 'online', '生产服务器'],
            ['机房A', 'A01', '交换机01', 'Cisco 2960', 'Cisco', '网络设备', '3', '1', '50', 'SN789012', '192.168.1.1', 'ssh', '22', 'online', '核心交换机'],
        ];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [15, 15, 20, 20, 15, 15, 8, 8, 10, 20, 15, 12, 12, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDeviceLibraryTemplateSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备库数据');

        $headers = ['设备名称*', '型号*', '制造商', '设备类型*', 'U高度', '功率(W)', '描述'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [
            ['Dell PowerEdge R740', 'Dell R740', 'Dell', '服务器', '2', '500', '2U机架式服务器'],
            ['Cisco Catalyst 2960', 'Cisco 2960', 'Cisco', '网络设备', '1', '50', '24口交换机'],
        ];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [20, 20, 15, 15, 8, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    private function createDeviceTypesTemplateSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('设备类型数据');

        $headers = ['设备类型名称*'];
        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2E8F0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $examples = [['服务器'], ['网络设备'], ['存储'], ['防火墙']];

        foreach ($examples as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        $columnWidths = [20];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }
    }

    public function previewAllImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());

            $errors = [];
            $stats = [
                'rooms' => ['total' => 0, 'new' => 0],
                'racks' => ['total' => 0, 'new' => 0],
                'devices' => ['total' => 0, 'new' => 0],
                'device_library' => ['total' => 0, 'new' => 0],
                'device_types' => ['total' => 0, 'new' => 0],
            ];

            $existingRooms = Room::pluck('name')->toArray();
            $existingRacks = Rack::with('room')->get()->keyBy(fn ($r) => $r->room->name.'|'.$r->name);
            $existingDeviceTypes = DeviceType::pluck('name')->toArray();
            $existingDeviceLibrary = DeviceLibrary::pluck('name')->toArray();

            if ($spreadsheet->getSheetByName('机房数据')) {
                $sheet = $spreadsheet->getSheetByName('机房数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0])) {
                        continue;
                    }
                    $stats['rooms']['total']++;
                    $roomName = trim($row[0]);
                    if (! in_array($roomName, $existingRooms)) {
                        $stats['rooms']['new']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('机柜数据')) {
                $sheet = $spreadsheet->getSheetByName('机柜数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1])) {
                        continue;
                    }
                    $stats['racks']['total']++;
                    $roomName = trim($row[0]);
                    $rackName = trim($row[1]);
                    if (! in_array($roomName, $existingRooms)) {
                        $errors[] = '机柜数据第'.($index + 2)."行：机房 '{$roomName}' 不存在";
                    } else {
                        $rackKey = $roomName.'|'.$rackName;
                        if (! isset($existingRacks[$rackKey])) {
                            $stats['racks']['new']++;
                        }
                    }
                }
            }

            if ($spreadsheet->getSheetByName('设备数据')) {
                $sheet = $spreadsheet->getSheetByName('设备数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1]) || empty($row[2])) {
                        continue;
                    }
                    $stats['devices']['total']++;
                    $roomName = trim($row[0]);
                    $rackName = trim($row[1]);
                    $deviceTypeName = trim($row[5]);
                    $deviceModel = trim($row[3]);

                    if (! in_array($roomName, $existingRooms)) {
                        $errors[] = '设备数据第'.($index + 2)."行：机房 '{$roomName}' 不存在";
                    }
                    if (! in_array($deviceTypeName, $existingDeviceTypes)) {
                        $stats['device_types']['new']++;
                    }
                    if (! in_array($deviceModel, $existingDeviceLibrary)) {
                        $stats['device_library']['new']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('设备库数据')) {
                $sheet = $spreadsheet->getSheetByName('设备库数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1])) {
                        continue;
                    }
                    $stats['device_library']['total']++;
                    $deviceTypeName = trim($row[3]);
                    if (! in_array($deviceTypeName, $existingDeviceTypes)) {
                        $stats['device_types']['new']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('设备类型数据')) {
                $sheet = $spreadsheet->getSheetByName('设备类型数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0])) {
                        continue;
                    }
                    $stats['device_types']['total']++;
                }
            }

            return response()->json([
                'success' => empty($errors),
                'stats' => $stats,
                'errors' => $errors,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'errors' => ['文件解析失败: '.$e->getMessage()],
            ], 422);
        }
    }

    public function importAll(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        DB::beginTransaction();

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());

            $stats = [
                'rooms' => ['created' => 0, 'updated' => 0],
                'racks' => ['created' => 0, 'updated' => 0],
                'devices' => ['created' => 0, 'updated' => 0],
                'device_library' => ['created' => 0, 'updated' => 0],
                'device_types' => ['created' => 0, 'updated' => 0],
                'errors' => [],
            ];

            $rooms = Room::all()->keyBy('name');
            $racks = Rack::with('room')->get()->keyBy(fn ($r) => $r->room->name.'|'.$r->name);
            $deviceTypes = DeviceType::all()->keyBy('name');
            $deviceLibrary = DeviceLibrary::all()->keyBy('model');

            if ($spreadsheet->getSheetByName('设备类型数据')) {
                $sheet = $spreadsheet->getSheetByName('设备类型数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0])) {
                        continue;
                    }
                    $typeName = trim($row[0]);
                    if (! $deviceTypes->has($typeName)) {
                        $deviceTypes->put($typeName, DeviceType::create(['name' => $typeName, 'icon' => 'server', 'color' => '#3B82F6']));
                        $stats['device_types']['created']++;
                    } else {
                        $stats['device_types']['updated']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('机房数据')) {
                $sheet = $spreadsheet->getSheetByName('机房数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0])) {
                        continue;
                    }
                    $roomName = trim($row[0]);
                    if (! $rooms->has($roomName)) {
                        $rooms->put($roomName, Room::create([
                            'name' => $roomName,
                            'location' => trim($row[1] ?? ''),
                            'manager' => trim($row[2] ?? ''),
                            'temp_humidity_url' => trim($row[3] ?? ''),
                            'description' => trim($row[4] ?? ''),
                        ]));
                        $stats['rooms']['created']++;
                    } else {
                        $room = $rooms->get($roomName);
                        $room->update([
                            'location' => trim($row[1] ?? '') ?: $room->location,
                            'manager' => trim($row[2] ?? '') ?: $room->manager,
                            'temp_humidity_url' => trim($row[3] ?? '') ?: $room->temp_humidity_url,
                            'description' => trim($row[4] ?? '') ?: $room->description,
                        ]);
                        $stats['rooms']['updated']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('机柜数据')) {
                $sheet = $spreadsheet->getSheetByName('机柜数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1])) {
                        continue;
                    }
                    $roomName = trim($row[0]);
                    $rackName = trim($row[1]);
                    $room = $rooms->get($roomName);
                    if (! $room) {
                        continue;
                    }

                    $rackKey = $roomName.'|'.$rackName;
                    if (! $racks->has($rackKey)) {
                        $racks->put($rackKey, Rack::create([
                            'room_id' => $room->id,
                            'name' => $rackName,
                            'rack_type_id' => $deviceTypes->has(trim($row[2] ?? '')) ? $deviceTypes->get(trim($row[2] ?? ''))->id : null,
                            'u_count' => intval($row[3] ?? 42),
                            'power' => intval($row[4] ?? 3000),
                            'temp_humidity_url' => trim($row[5] ?? ''),
                            'description' => trim($row[6] ?? ''),
                        ]));
                        $stats['racks']['created']++;
                    } else {
                        $rack = $racks->get($rackKey);
                        $rack->update([
                            'u_count' => intval($row[3] ?? $rack->u_count),
                            'power' => intval($row[4] ?? $rack->power),
                            'temp_humidity_url' => trim($row[5] ?? '') ?: $rack->temp_humidity_url,
                            'description' => trim($row[6] ?? '') ?: $rack->description,
                        ]);
                        $stats['racks']['updated']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('设备库数据')) {
                $sheet = $spreadsheet->getSheetByName('设备库数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1])) {
                        continue;
                    }
                    $model = trim($row[1]);
                    $deviceTypeName = trim($row[3] ?? '');
                    $deviceType = $deviceTypes->get($deviceTypeName);

                    if (! $deviceLibrary->has($model)) {
                        $deviceLibrary->put($model, DeviceLibrary::create([
                            'name' => trim($row[0]),
                            'model' => $model,
                            'manufacturer' => trim($row[2] ?? ''),
                            'device_type_id' => $deviceType?->id,
                            'u_height' => intval($row[4] ?? 1),
                            'power' => intval($row[5] ?? 0),
                            'description' => trim($row[6] ?? ''),
                        ]));
                        $stats['device_library']['created']++;
                    } else {
                        $lib = $deviceLibrary->get($model);
                        $lib->update([
                            'manufacturer' => trim($row[2] ?? '') ?: $lib->manufacturer,
                            'device_type_id' => $deviceType?->id ?? $lib->device_type_id,
                            'u_height' => intval($row[4] ?? $lib->u_height),
                            'power' => intval($row[5] ?? $lib->power),
                            'description' => trim($row[6] ?? '') ?: $lib->description,
                        ]);
                        $stats['device_library']['updated']++;
                    }
                }
            }

            if ($spreadsheet->getSheetByName('设备数据')) {
                $sheet = $spreadsheet->getSheetByName('设备数据');
                $rows = $sheet->toArray();
                array_shift($rows);
                foreach ($rows as $index => $row) {
                    if (empty($row[0]) || empty($row[1]) || empty($row[2])) {
                        continue;
                    }
                    $roomName = trim($row[0]);
                    $rackName = trim($row[1]);
                    $room = $rooms->get($roomName);
                    if (! $room) {
                        continue;
                    }

                    $rackKey = $roomName.'|'.$rackName;
                    $rack = $racks->get($rackKey);
                    if (! $rack) {
                        continue;
                    }

                    $deviceModel = trim($row[3]);
                    $library = $deviceLibrary->get($deviceModel);
                    if (! $library) {
                        continue;
                    }

                    $existingDevice = Device::where('rack_id', $rack->id)->where('u_position', intval($row[6] ?? 1))->first();
                    $deviceData = [
                        'name' => trim($row[2]),
                        'device_library_id' => $library->id,
                        'u_position' => intval($row[6] ?? 1),
                        'power' => intval($row[8] ?? 0) ?: $library->power,
                        'serial_number' => trim($row[9] ?? ''),
                        'ip_address' => trim($row[10] ?? ''),
                        'connection_type' => trim($row[11] ?? ''),
                        'connection_port' => intval($row[12] ?? 0),
                        'status' => trim($row[13] ?? 'offline'),
                        'description' => trim($row[14] ?? ''),
                    ];

                    if ($existingDevice) {
                        $existingDevice->update($deviceData);
                        $stats['devices']['updated']++;
                    } else {
                        $deviceData['rack_id'] = $rack->id;
                        Device::create($deviceData);
                        $stats['devices']['created']++;
                    }
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '全量导入完成',
                'stats' => $stats,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'errors' => ['导入失败: '.$e->getMessage()],
            ], 500);
        }
    }
}
