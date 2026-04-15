<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\Device;
use App\Models\MonitorMetric;
use App\Models\Rack;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Response;

class MonitorController extends Controller
{
    /**
     * 显示实时监控页面
     */
    public function index(): Response
    {
        $stats = $this->getSystemStats();
        $recentAlerts = Alert::active()
            ->orderByDesc('triggered_at')
            ->limit(5)
            ->get();

        return inertia('Monitor/Index', [
            'initialStats' => $stats,
            'recentAlerts' => $recentAlerts,
            'breadcrumbs' => [
                ['title' => '监控/报表', 'href' => '#'],
                ['title' => '实时监控', 'href' => '/monitor'],
            ],
        ]);
    }

    /**
     * 获取实时统计数据（API）
     */
    public function stats(): JsonResponse
    {
        return response()->json($this->getSystemStats());
    }

    /**
     * 获取设备状态分布
     */
    public function deviceStatus(): JsonResponse
    {
        $devices = Device::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'online' => $devices['online'] ?? 0,
            'offline' => $devices['offline'] ?? 0,
            'maintenance' => $devices['maintenance'] ?? 0,
            'total' => $devices->sum(),
        ]);
    }

    /**
     * 获取机房设备分布
     */
    public function roomDistribution(): JsonResponse
    {
        $rooms = Room::withCount(['racks', 'devices'])
            ->get()
            ->map(fn ($room) => [
                'id' => $room->id,
                'name' => $room->name,
                'rack_count' => $room->racks_count,
                'device_count' => $room->devices_count,
            ]);

        return response()->json($rooms);
    }

    /**
     * 获取告警统计
     */
    public function alertStats(): JsonResponse
    {
        $stats = [
            'critical' => Alert::ofSeverity('critical')->active()->count(),
            'warning' => Alert::ofSeverity('warning')->active()->count(),
            'info' => Alert::ofSeverity('info')->active()->count(),
            'total_active' => Alert::active()->count(),
            'today' => Alert::whereDate('triggered_at', today())->count(),
        ];

        return response()->json($stats);
    }

    /**
     * 获取最近指标数据
     */
    public function metrics(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'nullable|string|in:cpu,memory,disk,network,temperature',
            'hours' => 'nullable|integer|min:1|max:168',
        ]);

        $type = $request->input('type', 'cpu');
        $hours = $request->input('hours', 24);

        $metrics = MonitorMetric::ofType($type)
            ->where('recorded_at', '>=', now()->subHours($hours))
            ->orderBy('recorded_at')
            ->get()
            ->map(fn ($m) => [
                'time' => $m->recorded_at->format('Y-m-d H:i'),
                'value' => (float) $m->value,
                'unit' => $m->unit,
            ]);

        return response()->json($metrics);
    }

    /**
     * 获取实时设备列表
     */
    public function devices(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:online,offline,maintenance',
            'room_id' => 'nullable|integer',
        ]);

        $query = Device::with(['rack.room']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('room_id')) {
            $query->whereHas('rack', fn ($q) => $q->where('room_id', $request->input('room_id')));
        }

        $devices = $query->latest()
            ->limit(50)
            ->get()
            ->map(fn ($device) => [
                'id' => $device->id,
                'name' => $device->name,
                'status' => $device->status,
                'ip_address' => $device->ip_address,
                'category' => $device->category,
                'rack_name' => $device->rack?->name,
                'room_name' => $device->rack?->room?->name,
                'last_seen' => $device->updated_at?->diffForHumans(),
            ]);

        return response()->json($devices);
    }

    /**
     * 获取系统统计数据
     */
    private function getSystemStats(): array
    {
        $deviceStats = Device::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return [
            'rooms' => [
                'total' => Room::count(),
                'label' => '机房总数',
            ],
            'racks' => [
                'total' => Rack::count(),
                'label' => '机柜总数',
            ],
            'devices' => [
                'total' => Device::count(),
                'online' => $deviceStats['online'] ?? 0,
                'offline' => $deviceStats['offline'] ?? 0,
                'maintenance' => $deviceStats['maintenance'] ?? 0,
                'label' => '设备总数',
            ],
            'alerts' => [
                'critical' => Alert::ofSeverity('critical')->active()->count(),
                'warning' => Alert::ofSeverity('warning')->active()->count(),
                'total' => Alert::active()->count(),
                'label' => '活跃告警',
            ],
            'timestamp' => now()->toDateTimeString(),
        ];
    }
}
