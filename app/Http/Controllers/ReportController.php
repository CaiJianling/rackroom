<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\GeneratedReport;
use App\Models\ReportTemplate;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * 显示报表生成页面
     */
    public function index(): Response
    {
        $templates = ReportTemplate::accessibleBy(auth()->id())
            ->orderByDesc('created_at')
            ->get();

        $generatedReports = GeneratedReport::with('template')
            ->byUser(auth()->id())
            ->orderByDesc('started_at')
            ->limit(10)
            ->get();

        // 获取筛选选项数据
        $rooms = Room::select('id', 'name')->get();
        $categories = Device::distinct()->pluck('category');

        return inertia('Report/Index', [
            'templates' => $templates,
            'generatedReports' => $generatedReports,
            'filterOptions' => [
                'rooms' => $rooms,
                'categories' => $categories,
                'deviceStatuses' => ['online', 'offline', 'maintenance'],
            ],
            'breadcrumbs' => [
                ['title' => '报表生成', 'href' => '/reports'],
            ],
        ]);
    }

    /**
     * 生成报表
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'report_type' => 'required|string|in:inventory,status,usage,custom',
            'format' => 'required|string|in:csv,excel,json',
            'filters' => 'required|array',
            'filters.room_id' => 'nullable|integer',
            'filters.category' => 'nullable|string',
            'filters.status' => 'nullable|string',
            'filters.date_from' => 'nullable|date',
            'filters.date_to' => 'nullable|date|after_or_equal:filters.date_from',
            'include_charts' => 'boolean',
        ]);

        // 创建报表记录
        $report = GeneratedReport::create([
            'name' => $validated['name'],
            'report_type' => $validated['report_type'],
            'filters' => $validated['filters'],
            'parameters' => [
                'include_charts' => $validated['include_charts'] ?? false,
            ],
            'format' => $validated['format'],
            'generated_by' => $request->user()->id,
            'status' => 'processing',
            'started_at' => now(),
        ]);

        // 根据报表类型生成数据
        try {
            $data = $this->generateReportData($validated['report_type'], $validated['filters'] ?? []);
            $filePath = $this->exportData($data, $validated['format'], $report->id);

            $report->markAsCompleted($filePath, Storage::disk('reports')->size($filePath));

            return response()->json([
                'success' => true,
                'message' => '报表生成成功',
                'report' => $report->fresh(),
            ]);
        } catch (\Exception $e) {
            $report->markAsFailed($e->getMessage());

            return response()->json([
                'success' => false,
                'message' => '报表生成失败：'.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * 获取报表数据（用于预览）
     */
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report_type' => 'required|string|in:inventory,status,usage',
            'filters' => 'sometimes|array',
            'filters.room_id' => 'nullable|string',
            'filters.category' => 'nullable|string',
            'filters.status' => 'nullable|string',
        ]);

        $data = $this->generateReportData($validated['report_type'], $validated['filters'] ?? []);

        return response()->json([
            'data' => $data,
            'total' => count($data),
        ]);
    }

    /**
     * 获取图表数据
     */
    public function chartData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'chart_type' => 'required|string|in:status_distribution,category_distribution,room_distribution,timeline',
            'filters' => 'nullable|array',
        ]);

        $data = match ($validated['chart_type']) {
            'status_distribution' => $this->getStatusDistribution($validated['filters'] ?? []),
            'category_distribution' => $this->getCategoryDistribution($validated['filters'] ?? []),
            'room_distribution' => $this->getRoomDistribution($validated['filters'] ?? []),
            'timeline' => $this->getTimelineData($validated['filters'] ?? []),
            default => [],
        };

        return response()->json($data);
    }

    /**
     * 下载报表
     */
    public function download(GeneratedReport $report): StreamedResponse
    {
        if ($report->status !== 'completed' || ! $report->file_path) {
            abort(404, '报表文件不存在');
        }

        if (! Storage::disk('reports')->exists($report->file_path)) {
            abort(404, '报表文件已删除');
        }

        $extension = match ($report->format) {
            'csv' => 'csv',
            'excel' => 'xlsx',
            'json' => 'json',
            default => 'txt',
        };

        return Storage::disk('reports')->download(
            $report->file_path,
            $report->name.'.'.$extension
        );
    }

    /**
     * 删除报表
     */
    public function destroy(GeneratedReport $report): JsonResponse
    {
        if ($report->file_path && Storage::disk('reports')->exists($report->file_path)) {
            Storage::disk('reports')->delete($report->file_path);
        }

        $report->delete();

        return response()->json([
            'success' => true,
            'message' => '报表已删除',
        ]);
    }

    /**
     * 保存报表模板
     */
    public function saveTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'report_type' => 'required|string',
            'filters' => 'sometimes|array',
            'columns' => 'sometimes|array',
            'is_shared' => 'boolean',
        ]);

        $template = ReportTemplate::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'template' => $template,
        ], 201);
    }

    /**
     * 生成报表数据
     */
    private function generateReportData(string $type, array $filters): array
    {
        return match ($type) {
            'inventory' => $this->generateInventoryReport($filters),
            'status' => $this->generateStatusReport($filters),
            'usage' => $this->generateUsageReport($filters),
            default => [],
        };
    }

    /**
     * 生成资产清单报表
     */
    private function generateInventoryReport(array $filters): array
    {
        $query = Device::with(['rack.room', 'deviceLibrary.deviceType']);

        if (! empty($filters['room_id']) && $filters['room_id'] !== 'all') {
            $query->whereHas('rack', fn ($q) => $q->where('room_id', $filters['room_id']));
        }

        if (! empty($filters['category']) && $filters['category'] !== 'all') {
            $query->where('category', $filters['category']);
        }

        if (! empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        return $query->get()->map(fn ($device) => [
            'id' => $device->id,
            'name' => $device->name,
            'category' => $device->category,
            'model' => $device->deviceLibrary?->model,
            'manufacturer' => $device->deviceLibrary?->manufacturer,
            'serial_number' => $device->serial_number,
            'ip_address' => $device->ip_address,
            'status' => $device->status,
            'rack_name' => $device->rack?->name,
            'room_name' => $device->rack?->room?->name,
            'u_position' => $device->u_position,
            'power' => $device->power,
            'created_at' => $device->created_at->format('Y-m-d'),
        ])->toArray();
    }

    /**
     * 生成状态报表
     */
    private function generateStatusReport(array $filters): array
    {
        $query = Device::with(['rack.room']);

        if (! empty($filters['room_id']) && $filters['room_id'] !== 'all') {
            $query->whereHas('rack', fn ($q) => $q->where('room_id', $filters['room_id']));
        }

        if (! empty($filters['category']) && $filters['category'] !== 'all') {
            $query->where('category', $filters['category']);
        }

        return $query->get()->map(fn ($device) => [
            'id' => $device->id,
            'name' => $device->name,
            'status' => $device->status,
            'ip_address' => $device->ip_address,
            'last_seen' => $device->updated_at->diffForHumans(),
            'rack_name' => $device->rack?->name,
            'room_name' => $device->rack?->room?->name,
            'connection_type' => $device->connection_type,
            'connection_port' => $device->connection_port,
        ])->toArray();
    }

    /**
     * 生成使用率报表
     */
    private function generateUsageReport(array $filters): array
    {
        $roomId = $filters['room_id'] ?? null;

        $rooms = Room::when($roomId && $roomId !== 'all', fn ($q) => $q->where('id', $roomId))
            ->with(['racks.devices'])
            ->get();

        return $rooms->map(fn ($room) => [
            'room_id' => $room->id,
            'room_name' => $room->name,
            'rack_count' => $room->racks->count(),
            'device_count' => $room->racks->sum(fn ($r) => $r->devices->count()),
            'total_u_count' => $room->racks->sum('u_count'),
            'used_u_count' => $room->racks->sum(fn ($r) => $r->devices->sum('u_height')),
            'usage_rate' => $room->racks->sum('u_count') > 0
                ? round(($room->racks->sum(fn ($r) => $r->devices->sum('u_height')) / $room->racks->sum('u_count')) * 100, 2)
                : 0,
            'power_usage' => $room->racks->sum(fn ($r) => $r->devices->sum('power')),
        ])->toArray();
    }

    /**
     * 导出数据
     */
    private function exportData(array $data, string $format, int $reportId): string
    {
        $filename = "report_{$reportId}_".time();

        return match ($format) {
            'csv' => $this->exportToCsv($data, $filename),
            'json' => $this->exportToJson($data, $filename),
            default => $this->exportToCsv($data, $filename),
        };
    }

    /**
     * 导出为CSV
     */
    private function exportToCsv(array $data, string $filename): string
    {
        if (empty($data)) {
            $filepath = "reports/{$filename}.csv";
            Storage::disk('reports')->put($filepath, '');

            return $filepath;
        }

        $headers = array_keys($data[0]);
        $csv = implode(',', $headers)."\n";

        foreach ($data as $row) {
            $csv .= implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', $v).'"', $row))."\n";
        }

        $filepath = "reports/{$filename}.csv";
        Storage::disk('reports')->put($filepath, $csv);

        return $filepath;
    }

    /**
     * 导出为JSON
     */
    private function exportToJson(array $data, string $filename): string
    {
        $filepath = "reports/{$filename}.json";
        Storage::disk('reports')->put($filepath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $filepath;
    }

    /**
     * 获取状态分布数据
     */
    private function getStatusDistribution(array $filters): array
    {
        $query = Device::query();

        if (! empty($filters['room_id']) && $filters['room_id'] !== 'all') {
            $query->whereHas('rack', fn ($q) => $q->where('room_id', $filters['room_id']));
        }

        return $query->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get()
            ->map(fn ($item) => [
                'name' => $item->status,
                'value' => $item->count,
            ])
            ->toArray();
    }

    /**
     * 获取分类分布数据
     */
    private function getCategoryDistribution(array $filters): array
    {
        $query = Device::query();

        if (! empty($filters['room_id']) && $filters['room_id'] !== 'all') {
            $query->whereHas('rack', fn ($q) => $q->where('room_id', $filters['room_id']));
        }

        return $query->selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->get()
            ->map(fn ($item) => [
                'name' => $item->category,
                'value' => $item->count,
            ])
            ->toArray();
    }

    /**
     * 获取机房分布数据
     */
    private function getRoomDistribution(array $filters): array
    {
        return Room::withCount('devices')
            ->get()
            ->map(fn ($room) => [
                'name' => $room->name,
                'value' => $room->devices_count,
            ])
            ->toArray();
    }

    /**
     * 获取时间线数据
     */
    private function getTimelineData(array $filters): array
    {
        $days = 7;
        $data = [];

        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i);
            $query = Device::whereDate('created_at', '<=', $date);

            if (! empty($filters['room_id'])) {
                $query->whereHas('rack', fn ($q) => $q->where('room_id', $filters['room_id']));
            }

            $data[] = [
                'date' => $date->format('m-d'),
                'count' => $query->count(),
            ];
        }

        return $data;
    }
}
