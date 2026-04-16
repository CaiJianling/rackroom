<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RackExcelController extends Controller
{
    /**
     * 导出机柜设备数据到 Excel
     */
    public function export(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('机柜设备数据');

        // 设置表头
        $headers = [
            '机房名称', '机柜名称', '机柜U数', '机柜功率(W)',
            '设备名称', '设备型号', '制造商', '设备类型',
            'U位', 'U高度', '功率(W)', '序列号',
            'IP地址', '连接类型', '连接端口', '状态', '描述',
        ];

        foreach ($headers as $index => $header) {
            $col = chr(65 + $index); // A, B, C...
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'E2E8F0'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                ],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => '94A3B8'],
                    ],
                ],
            ]);
        }

        // 获取所有设备数据
        $devices = Device::with(['rack.room', 'deviceLibrary.deviceType'])->get();

        $row = 2;
        foreach ($devices as $device) {
            $rack = $device->rack;
            $room = $rack?->room;
            $library = $device->deviceLibrary;
            $deviceType = $library?->deviceType;

            $sheet->setCellValue('A'.$row, $room?->name ?? '');
            $sheet->setCellValue('B'.$row, $rack?->name ?? '');
            $sheet->setCellValue('C'.$row, $rack?->u_count ?? '');
            $sheet->setCellValue('D'.$row, $rack?->power ?? '');
            $sheet->setCellValue('E'.$row, $device->name);
            $sheet->setCellValue('F'.$row, $library?->model ?? '');
            $sheet->setCellValue('G'.$row, $library?->manufacturer ?? '');
            $sheet->setCellValue('H'.$row, $deviceType?->name ?? '');
            $sheet->setCellValue('I'.$row, $device->u_position ?? '');
            $sheet->setCellValue('J'.$row, $library?->u_height ?? 1);
            $sheet->setCellValue('K'.$row, $device->power ?? ($library?->power ?? 0));
            $sheet->setCellValue('L'.$row, $device->serial_number ?? '');
            $sheet->setCellValue('M'.$row, $device->ip_address ?? '');
            $sheet->setCellValue('N'.$row, $device->connection_type ?? '');
            $sheet->setCellValue('O'.$row, $device->connection_port ?? '');
            $sheet->setCellValue('P'.$row, $device->status ?? 'offline');
            $sheet->setCellValue('Q'.$row, $device->description ?? '');

            $row++;
        }

        // 设置列宽
        $columnWidths = [15, 15, 10, 12, 20, 20, 15, 15, 8, 8, 10, 20, 15, 12, 12, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }

        // 添加数据验证说明工作表
        $this->addInstructionSheet($spreadsheet);

        $filename = 'rackroom_devices_'.now()->format('Y-m-d_H-i-s').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * 下载 Excel 模板
     */
    public function downloadTemplate(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('导入模板');

        // 设置表头
        $headers = [
            '机房名称*', '机柜名称*', '机柜U数', '机柜功率(W)',
            '设备名称*', '设备型号*', '制造商', '设备类型*',
            'U位*', 'U高度', '功率(W)', '序列号',
            'IP地址', '连接类型', '连接端口', '状态', '描述',
        ];

        foreach ($headers as $index => $header) {
            $col = chr(65 + $index);
            $sheet->setCellValue($col.'1', $header);
            $sheet->getStyle($col.'1')->applyFromArray([
                'font' => ['bold' => true],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'E2E8F0'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                ],
            ]);
        }

        // 添加示例数据
        $exampleData = [
            ['机房A', 'A01', '42', '3000', '服务器01', 'Dell R740', 'Dell', '服务器', '1', '2', '500', 'SN123456', '192.168.1.10', 'ssh', '22', 'online', '生产服务器'],
            ['机房A', 'A01', '42', '3000', '交换机01', 'Cisco 2960', 'Cisco', '网络设备', '3', '1', '50', 'SN789012', '192.168.1.1', 'ssh', '22', 'online', '核心交换机'],
            ['机房B', 'B02', '42', '2500', '存储01', 'EMC Unity', 'EMC', '存储', '1', '4', '800', 'SN345678', '192.168.2.10', 'web', '443', 'online', '存储阵列'],
        ];

        foreach ($exampleData as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        // 添加说明工作表
        $this->addInstructionSheet($spreadsheet);

        $columnWidths = [15, 15, 10, 12, 20, 20, 15, 15, 8, 8, 10, 20, 15, 12, 12, 10, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, 'rackroom_import_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * 添加说明工作表
     */
    private function addInstructionSheet(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('填写说明');

        $instructions = [
            ['字段说明', ''],
            ['', ''],
            ['带 * 的字段为必填项', ''],
            ['', ''],
            ['机房名称*', '设备所在的机房名称，必须存在于系统中'],
            ['机柜名称*', '设备所在的机柜名称，必须存在于系统中'],
            ['机柜U数', '机柜的总U数，如导入时机柜不存在则使用该值创建'],
            ['机柜功率(W)', '机柜的额定功率，如导入时机柜不存在则使用该值创建'],
            ['', ''],
            ['设备名称*', '设备的名称'],
            ['设备型号*', '设备的型号，用于匹配或创建设备库条目'],
            ['制造商', '设备制造商'],
            ['设备类型*', '设备类型名称，如不存在将自动创建'],
            ['U位*', '设备在机柜中的起始U位（从1开始）'],
            ['U高度', '设备占用的U数，默认为1'],
            ['功率(W)', '设备功率'],
            ['序列号', '设备序列号'],
            ['IP地址', '设备IP地址'],
            ['连接类型', '连接方式：ssh/telnet/web/ipmi等'],
            ['连接端口', '连接端口号'],
            ['状态', '设备状态：online/offline/maintenance'],
            ['描述', '设备描述'],
            ['', ''],
            ['导入规则', ''],
            ['1.', '如果机房不存在，将返回错误'],
            ['2.', '如果机柜不存在，将在该机柜所属的机房下自动创建机柜'],
            ['3.', '如果设备类型不存在，将自动创建设备类型'],
            ['4.', '如果设备库中不存在该型号，将自动创建设备库条目'],
            ['5.', '如果设备已存在（同机柜同U位），将更新设备信息'],
        ];

        foreach ($instructions as $rowIndex => $row) {
            $sheet->setCellValue('A'.($rowIndex + 1), $row[0]);
            if (isset($row[1])) {
                $sheet->setCellValue('B'.($rowIndex + 1), $row[1]);
            }
        }

        $sheet->getColumnDimension('A')->setWidth(20);
        $sheet->getColumnDimension('B')->setWidth(60);
    }

    /**
     * 预览 Excel 导入数据
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray();

            // 移除表头
            array_shift($rows);

            $preview = [];
            $errors = [];
            $stats = [
                'total' => 0,
                'new_rooms' => 0,
                'new_racks' => 0,
                'new_device_types' => 0,
                'new_device_library' => 0,
                'new_devices' => 0,
                'update_devices' => 0,
            ];

            // 获取现有数据用于检查
            $existingRooms = Room::pluck('name')->toArray();
            $existingRacks = Rack::with('room')->get()->keyBy(function ($rack) {
                return $rack->room->name.'|'.$rack->name;
            });
            $existingDeviceTypes = DeviceType::pluck('name')->toArray();
            $existingDeviceLibrary = DeviceLibrary::all()->keyBy('model');

            $processedRooms = [];
            $processedRacks = [];
            $processedDeviceTypes = [];
            $processedDeviceLibrary = [];

            foreach ($rows as $index => $row) {
                if (empty($row[0]) && empty($row[1])) {
                    continue;
                }

                $stats['total']++;
                $rowNum = $index + 2;

                $roomName = trim($row[0] ?? '');
                $rackName = trim($row[1] ?? '');
                $deviceName = trim($row[4] ?? '');
                $deviceModel = trim($row[5] ?? '');
                $deviceTypeName = trim($row[7] ?? '');

                // 验证必填字段
                if (empty($roomName)) {
                    $errors[] = "第 {$rowNum} 行：机房名称不能为空";

                    continue;
                }
                if (empty($rackName)) {
                    $errors[] = "第 {$rowNum} 行：机柜名称不能为空";

                    continue;
                }
                if (empty($deviceName)) {
                    $errors[] = "第 {$rowNum} 行：设备名称不能为空";

                    continue;
                }
                if (empty($deviceModel)) {
                    $errors[] = "第 {$rowNum} 行：设备型号不能为空";

                    continue;
                }
                if (empty($deviceTypeName)) {
                    $errors[] = "第 {$rowNum} 行：设备类型不能为空";

                    continue;
                }

                // 检查机房是否存在
                if (! in_array($roomName, $existingRooms)) {
                    $errors[] = "第 {$rowNum} 行：机房 '{$roomName}' 不存在，请先创建机房";

                    continue;
                }

                // 检查机柜
                $rackKey = $roomName.'|'.$rackName;
                if (! isset($existingRacks[$rackKey]) && ! isset($processedRacks[$rackKey])) {
                    $stats['new_racks']++;
                    $processedRacks[$rackKey] = true;
                }

                // 检查设备类型
                if (! in_array($deviceTypeName, $existingDeviceTypes) && ! isset($processedDeviceTypes[$deviceTypeName])) {
                    $stats['new_device_types']++;
                    $processedDeviceTypes[$deviceTypeName] = true;
                }

                // 检查设备库
                if (! isset($existingDeviceLibrary[$deviceModel]) && ! isset($processedDeviceLibrary[$deviceModel])) {
                    $stats['new_device_library']++;
                    $processedDeviceLibrary[$deviceModel] = true;
                }

                // 检查设备是否存在
                $rack = $existingRacks[$rackKey] ?? null;
                if ($rack) {
                    $existingDevice = Device::where('rack_id', $rack->id)
                        ->where('u_position', $row[8] ?? 0)
                        ->first();
                    if ($existingDevice) {
                        $stats['update_devices']++;
                    } else {
                        $stats['new_devices']++;
                    }
                } else {
                    $stats['new_devices']++;
                }

                $preview[] = [
                    'row' => $rowNum,
                    'room_name' => $roomName,
                    'rack_name' => $rackName,
                    'device_name' => $deviceName,
                    'device_model' => $deviceModel,
                    'device_type' => $deviceTypeName,
                ];
            }

            return response()->json([
                'success' => empty($errors),
                'preview' => array_slice($preview, 0, 10),
                'stats' => $stats,
                'errors' => $errors,
                'total_rows' => count($preview),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'errors' => ['文件解析失败: '.$e->getMessage()],
            ], 422);
        }
    }

    /**
     * 导入 Excel 数据
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        DB::beginTransaction();

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray();

            // 移除表头
            array_shift($rows);

            $stats = [
                'new_racks' => 0,
                'new_device_types' => 0,
                'new_device_library' => 0,
                'new_devices' => 0,
                'updated_devices' => 0,
                'errors' => [],
            ];

            // 缓存
            $rooms = Room::all()->keyBy('name');
            $racks = Rack::with('room')->get()->keyBy(function ($rack) {
                return $rack->room->name.'|'.$rack->name;
            });
            $deviceTypes = DeviceType::all()->keyBy('name');
            $deviceLibrary = DeviceLibrary::all()->keyBy('model');

            foreach ($rows as $index => $row) {
                if (empty($row[0]) && empty($row[1])) {
                    continue;
                }

                $rowNum = $index + 2;

                $roomName = trim($row[0] ?? '');
                $rackName = trim($row[1] ?? '');
                $rackUCount = intval($row[2] ?? 42);
                $rackPower = intval($row[3] ?? 3000);
                $deviceName = trim($row[4] ?? '');
                $deviceModel = trim($row[5] ?? '');
                $manufacturer = trim($row[6] ?? '');
                $deviceTypeName = trim($row[7] ?? '');
                $uPosition = intval($row[8] ?? 1);
                $uHeight = intval($row[9] ?? 1);
                $power = intval($row[10] ?? 0);
                $serialNumber = trim($row[11] ?? '');
                $ipAddress = trim($row[12] ?? '');
                $connectionType = trim($row[13] ?? '');
                $connectionPort = intval($row[14] ?? 0);
                $status = trim($row[15] ?? 'offline');
                $description = trim($row[16] ?? '');

                // 跳过无效行
                if (empty($roomName) || empty($rackName) || empty($deviceName)) {
                    continue;
                }

                // 获取或创建机房
                $room = $rooms->get($roomName);
                if (! $room) {
                    $stats['errors'][] = "第 {$rowNum} 行：机房 '{$roomName}' 不存在";

                    continue;
                }

                // 获取或创建机柜
                $rackKey = $roomName.'|'.$rackName;
                $rack = $racks->get($rackKey);
                if (! $rack) {
                    $rack = Rack::create([
                        'room_id' => $room->id,
                        'name' => $rackName,
                        'u_count' => $rackUCount,
                        'power' => $rackPower,
                    ]);
                    $racks->put($rackKey, $rack);
                    $stats['new_racks']++;
                }

                // 获取或创建设备类型
                $deviceType = $deviceTypes->get($deviceTypeName);
                if (! $deviceType) {
                    $deviceType = DeviceType::create([
                        'name' => $deviceTypeName,
                        'icon' => 'server',
                        'color' => '#3B82F6',
                    ]);
                    $deviceTypes->put($deviceTypeName, $deviceType);
                    $stats['new_device_types']++;
                }

                // 获取或创建设备库条目
                $library = $deviceLibrary->get($deviceModel);
                if (! $library) {
                    $library = DeviceLibrary::create([
                        'device_type_id' => $deviceType->id,
                        'name' => $deviceName,
                        'model' => $deviceModel,
                        'manufacturer' => $manufacturer,
                        'u_height' => $uHeight,
                        'power' => $power,
                    ]);
                    $deviceLibrary->put($deviceModel, $library);
                    $stats['new_device_library']++;
                }

                // 检查设备是否已存在
                $existingDevice = Device::where('rack_id', $rack->id)
                    ->where('u_position', $uPosition)
                    ->first();

                $deviceData = [
                    'rack_id' => $rack->id,
                    'name' => $deviceName,
                    'device_library_id' => $library->id,
                    'u_position' => $uPosition,
                    'power' => $power ?: $library->power,
                    'serial_number' => $serialNumber,
                    'ip_address' => $ipAddress,
                    'connection_type' => $connectionType,
                    'connection_port' => $connectionPort,
                    'status' => $status,
                    'description' => $description,
                ];

                if ($existingDevice) {
                    $existingDevice->update($deviceData);
                    $stats['updated_devices']++;
                } else {
                    Device::create($deviceData);
                    $stats['new_devices']++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '导入完成',
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
