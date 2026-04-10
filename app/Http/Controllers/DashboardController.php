<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\Device;
use App\Models\Rack;
use App\Models\Room;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * 显示仪表盘页面
     */
    public function index(): Response
    {
        $stats = $this->getStats();
        $deviceStatusDistribution = $this->getDeviceStatusDistribution();
        $roomDistribution = $this->getRoomDistribution();
        $recentAlerts = $this->getRecentAlerts();
        $recentDevices = $this->getRecentDevices();
        $categoryDistribution = $this->getCategoryDistribution();

        return inertia('dashboard', [
            'stats' => $stats,
            'deviceStatusDistribution' => $deviceStatusDistribution,
            'roomDistribution' => $roomDistribution,
            'recentAlerts' => $recentAlerts,
            'recentDevices' => $recentDevices,
            'categoryDistribution' => $categoryDistribution,
        ]);
    }

    /**
     * 获取关键统计数据
     */
    private function getStats(): array
    {
        $deviceStats = Device::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $totalPower = Device::sum('power');
        $activeAlerts = Alert::active()->count();

        return [
            'rooms' => [
                'total' => Room::count(),
                'label' => '机房总数',
                'icon' => 'Building2',
                'color' => 'blue',
                'href' => '/rooms',
            ],
            'racks' => [
                'total' => Rack::count(),
                'label' => '机柜总数',
                'icon' => 'Server',
                'color' => 'indigo',
                'href' => '/racks',
            ],
            'devices' => [
                'total' => Device::count(),
                'online' => $deviceStats['online'] ?? 0,
                'offline' => $deviceStats['offline'] ?? 0,
                'maintenance' => $deviceStats['maintenance'] ?? 0,
                'label' => '设备总数',
                'icon' => 'Cpu',
                'color' => 'green',
                'href' => '/devices',
            ],
            'alerts' => [
                'total' => $activeAlerts,
                'critical' => Alert::ofSeverity('critical')->active()->count(),
                'warning' => Alert::ofSeverity('warning')->active()->count(),
                'label' => '活跃告警',
                'icon' => 'AlertTriangle',
                'color' => 'red',
                'href' => '/alerts',
            ],
            'power' => [
                'total' => $totalPower,
                'label' => '总功率',
                'icon' => 'Zap',
                'color' => 'yellow',
                'unit' => 'W',
            ],
        ];
    }

    /**
     * 获取设备状态分布
     */
    private function getDeviceStatusDistribution(): array
    {
        $data = Device::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get();

        $colors = [
            'online' => '#10b981',
            'offline' => '#ef4444',
            'maintenance' => '#f59e0b',
        ];

        return $data->map(fn ($item) => [
            'name' => $item->status,
            'value' => $item->count,
            'color' => $colors[$item->status] ?? '#6b7280',
        ])->toArray();
    }

    /**
     * 获取机房分布
     */
    private function getRoomDistribution(): array
    {
        return Room::withCount(['racks', 'devices'])
            ->orderByDesc('devices_count')
            ->get()
            ->map(fn ($room) => [
                'id' => $room->id,
                'name' => $room->name,
                'racks' => $room->racks_count,
                'devices' => $room->devices_count,
            ])
            ->toArray();
    }

    /**
     * 获取分类分布
     */
    private function getCategoryDistribution(): array
    {
        return Device::selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->get()
            ->map(fn ($item) => [
                'name' => $item->category,
                'value' => $item->count,
            ])
            ->toArray();
    }

    /**
     * 获取最近告警
     */
    private function getRecentAlerts(): array
    {
        return Alert::active()
            ->orderByDesc('triggered_at')
            ->limit(5)
            ->get()
            ->map(fn ($alert) => [
                'id' => $alert->id,
                'title' => $alert->title,
                'severity' => $alert->severity,
                'triggered_at' => $alert->triggered_at->diffForHumans(),
            ])
            ->toArray();
    }

    /**
     * 获取最近添加的设备
     */
    private function getRecentDevices(): array
    {
        return Device::with(['rack.room'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($device) => [
                'id' => $device->id,
                'name' => $device->name,
                'status' => $device->status,
                'category' => $device->category,
                'room_name' => $device->rack?->room?->name,
                'created_at' => $device->created_at->diffForHumans(),
            ])
            ->toArray();
    }
}
