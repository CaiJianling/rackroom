<?php

namespace App\Http\Controllers;

use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use App\Models\RackType;
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

class RackController extends Controller
{
    public function index(Request $request)
    {
        $query = Rack::with(['room', 'rackType'])->withCount('devices');

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                ->orWhereHas('room', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                });
        }

        $roomFilter = $request->input('room');
        if ($roomFilter && $roomFilter !== 'all') {
            $query->where('room_id', $roomFilter);
        }

        $racks = $query->latest()->get();
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Index', [
            'racks' => $racks,
            'rooms' => $rooms,
            'rackTypes' => $rackTypes,
            'breadcrumbs' => [
                ['title' => __('navigation.rackManagement'), 'href' => '#'],
                ['title' => __('navigation.rackList'), 'href' => '/racks'],
            ],
        ]);
    }

    public function visualEdit(Request $request)
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        $roomId = $request->input('room_id');
        $query = Rack::with(['room', 'devices.deviceLibrary.deviceType']);

        if ($roomId) {
            $query->where('room_id', $roomId);
        }

        $racks = $query->orderBy('room_id')->orderBy('name')->get();
        $deviceLibrary = DeviceLibrary::with('deviceType')->get();
        $deviceTypes = DeviceType::all();

        // 获取所有已使用的设备库ID（用于设备库列表过滤）
        $usedLibraryIds = \App\Models\Device::whereNotNull('device_library_id')
            ->pluck('device_library_id')
            ->unique()
            ->values()
            ->toArray();

        return inertia('Rack/VisualEdit', [
            'racks' => $racks,
            'rooms' => $rooms,
            'rackTypes' => $rackTypes,
            'deviceLibrary' => $deviceLibrary,
            'deviceTypes' => $deviceTypes,
            'selectedRoom' => $roomId,
            'usedLibraryIds' => $usedLibraryIds,
            'breadcrumbs' => [
                ['title' => __('navigation.rackVisualEdit'), 'href' => '/racks/visual-edit'],
            ],
        ]);
    }

    public function create()
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Create', compact('rooms', 'rackTypes'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'rack_type_id' => 'nullable|exists:rack_types,id',
            'name' => 'required|string|max:255',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
            'temp_humidity_url' => 'nullable|url|max:500',
        ]);

        if ($validated['rack_type_id']) {
            $rackType = RackType::find($validated['rack_type_id']);
            $validated['u_count'] = $rackType->u_count;
            $validated['power'] = $rackType->power;
        } else {
            $validated['u_count'] = 42;
            $validated['power'] = 0;
        }

        Rack::create($validated);

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.created'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.created'));
        }

        return redirect()->route('racks.index')->with('success', __('validation.created'));
    }

    public function show(Rack $rack)
    {
        return inertia('Rack/Show', compact('rack'));
    }

    public function edit(Rack $rack)
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Edit', compact('rack', 'rooms', 'rackTypes'));
    }

    public function update(Request $request, Rack $rack)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'rack_type_id' => 'nullable|exists:rack_types,id',
            'name' => 'required|string|max:255',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
            'temp_humidity_url' => 'nullable|url|max:500',
        ]);

        // 检查是否有关联设备
        if ($rack->devices()->exists()) {
            // 如果有设备，只允许修改名称、所属机房、描述，不能修改机柜类型
            $validated = $request->validate([
                'room_id' => 'required|exists:rooms,id',
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
            ]);

            // 如果尝试修改机柜类型，返回错误
            if ($request->input('rack_type_id') != $rack->rack_type_id) {
                if ($request->header('X-Inertia') && $request->wantsJson()) {
                    return back()->with('error', __('validation.rack_type_locked'));
                }

                return redirect()->route('racks.index')
                    ->with('error', __('validation.rack_type_locked'));
            }

            // 保留原有的机柜类型信息
            $validated['rack_type_id'] = $rack->rack_type_id;
            $validated['u_count'] = $rack->u_count;
            $validated['power'] = $rack->power;
        } else {
            // 没有设备时可以修改所有字段
            if ($validated['rack_type_id']) {
                $rackType = RackType::find($validated['rack_type_id']);
                $validated['u_count'] = $rackType->u_count;
                $validated['power'] = $rackType->power;
            } else {
                $validated['u_count'] = 42;
                $validated['power'] = 0;
            }
        }

        $rack->update($validated);

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.updated'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.updated'));
        }

        return redirect()->route('racks.index')->with('success', __('validation.updated'));
    }

    public function destroy(Request $request, Rack $rack)
    {
        // 检查是否有关联设备
        if ($rack->devices()->exists()) {
            if ($request->header('X-Inertia') && $request->wantsJson()) {
                return back()->with('error', __('validation.rack_has_devices_delete'));
            }

            return redirect()->route('racks.index')
                ->with('error', __('validation.rack_has_devices_delete'));
        }

        $rack->delete();

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.deleted'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.deleted'));
        }

        return redirect()->route('racks.index')->with('success', __('validation.deleted'));
    }

    /**
     * 导出机柜数据到 Excel
     */
    public function exportExcel(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('机柜数据');

        // 设置表头
        $headers = ['机房名称', '机柜名称', '机柜类型', 'U数', '功率(W)', '设备数量', '描述'];
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
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => '94A3B8'],
                    ],
                ],
            ]);
        }

        // 获取所有机柜数据
        $racks = Rack::with(['room', 'rackType'])->withCount('devices')->get();

        $row = 2;
        foreach ($racks as $rack) {
            $sheet->setCellValue('A'.$row, $rack->room?->name ?? '-');
            $sheet->setCellValue('B'.$row, $rack->name);
            $sheet->setCellValue('C'.$row, $rack->rackType?->name ?? '-');
            $sheet->setCellValue('D'.$row, $rack->u_count);
            $sheet->setCellValue('E'.$row, $rack->power);
            $sheet->setCellValue('F'.$row, $rack->devices_count);
            $sheet->setCellValue('G'.$row, $rack->description ?? '-');
            $row++;
        }

        // 设置列宽
        $columnWidths = [20, 20, 20, 10, 12, 12, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }

        $filename = 'racks_'.now()->format('Y-m-d_H-i-s').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * 下载机柜导入模板
     */
    public function downloadTemplate(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('机柜导入模板');

        // 设置表头
        $headers = ['机房名称*', '机柜名称*', '机柜类型', 'U数', '功率(W)', '描述'];
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
            ['机房A', 'A01', '标准机柜', '42', '3000', '核心交换机机柜'],
            ['机房A', 'A02', '标准机柜', '42', '3000', '服务器机柜'],
            ['机房B', 'B01', '小型机柜', '24', '1500', '边缘机房机柜'],
        ];

        foreach ($exampleData as $rowIndex => $rowData) {
            foreach ($rowData as $colIndex => $value) {
                $sheet->setCellValue(chr(65 + $colIndex).($rowIndex + 2), $value);
            }
        }

        // 设置列宽
        $columnWidths = [20, 20, 20, 10, 12, 30];
        foreach ($columnWidths as $index => $width) {
            $sheet->getColumnDimension(chr(65 + $index))->setWidth($width);
        }

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
            $writer->save('php://output');
        }, 'rack_import_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * 预览 Excel 导入数据
     */
    public function importPreview(Request $request): JsonResponse
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
                'valid' => 0,
                'invalid' => 0,
            ];

            // 获取现有数据用于验证
            $existingRooms = Room::pluck('name')->toArray();
            $existingRackTypes = RackType::pluck('name')->toArray();

            foreach ($rows as $index => $row) {
                if (empty($row[0]) && empty($row[1])) {
                    continue;
                }

                $stats['total']++;
                $rowNum = $index + 2;

                $roomName = trim($row[0] ?? '');
                $rackName = trim($row[1] ?? '');
                $rackTypeName = trim($row[2] ?? '');
                $uCount = intval($row[3] ?? 42);
                $power = intval($row[4] ?? 0);
                $description = trim($row[5] ?? '');

                // 验证必填字段
                if (empty($roomName)) {
                    $errors[] = "第 {$rowNum} 行：机房名称不能为空";
                    $stats['invalid']++;

                    continue;
                }
                if (empty($rackName)) {
                    $errors[] = "第 {$rowNum} 行：机柜名称不能为空";
                    $stats['invalid']++;

                    continue;
                }

                // 检查机房是否存在
                if (! in_array($roomName, $existingRooms)) {
                    $errors[] = "第 {$rowNum} 行：机房 '{$roomName}' 不存在";
                    $stats['invalid']++;

                    continue;
                }

                $stats['valid']++;
                $preview[] = [
                    'row' => $rowNum,
                    'room_name' => $roomName,
                    'rack_name' => $rackName,
                    'rack_type' => $rackTypeName ?: '-',
                    'u_count' => $uCount,
                    'power' => $power,
                ];
            }

            return response()->json([
                'success' => empty($errors),
                'preview' => array_slice($preview, 0, 10),
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

    /**
     * 导入 Excel 数据
     */
    public function importExcel(Request $request): JsonResponse
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
                'imported' => 0,
                'skipped' => 0,
                'errors' => [],
            ];

            // 缓存
            $rooms = Room::all()->keyBy('name');
            $rackTypes = RackType::all()->keyBy('name');

            foreach ($rows as $index => $row) {
                if (empty($row[0]) && empty($row[1])) {
                    continue;
                }

                $rowNum = $index + 2;

                $roomName = trim($row[0] ?? '');
                $rackName = trim($row[1] ?? '');
                $rackTypeName = trim($row[2] ?? '');
                $uCount = intval($row[3] ?: 42);
                $power = intval($row[4] ?: 0);
                $description = trim($row[5] ?? '');

                // 跳过无效行
                if (empty($roomName) || empty($rackName)) {
                    $stats['skipped']++;

                    continue;
                }

                // 获取机房
                $room = $rooms->get($roomName);
                if (! $room) {
                    $stats['errors'][] = "第 {$rowNum} 行：机房 '{$roomName}' 不存在";
                    $stats['skipped']++;

                    continue;
                }

                // 获取机柜类型
                $rackType = $rackTypeName ? $rackTypes->get($rackTypeName) : null;

                // 检查机柜是否已存在（同机房同名）
                $existingRack = Rack::where('room_id', $room->id)
                    ->where('name', $rackName)
                    ->first();

                if ($existingRack) {
                    $stats['errors'][] = "第 {$rowNum} 行：机柜 '{$rackName}' 在机房 '{$roomName}' 中已存在";
                    $stats['skipped']++;

                    continue;
                }

                // 创建机柜
                Rack::create([
                    'room_id' => $room->id,
                    'rack_type_id' => $rackType?->id,
                    'name' => $rackName,
                    'u_count' => $rackType ? $rackType->u_count : $uCount,
                    'power' => $rackType ? $rackType->power : $power,
                    'device_count' => 0,
                    'description' => $description,
                ]);

                $stats['imported']++;
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
