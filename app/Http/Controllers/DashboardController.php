<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\Device;
use App\Models\DeviceType;
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
        $deviceTypes = $this->getDeviceTypes();

        return inertia('dashboard', [
            'stats' => $stats,
            'deviceStatusDistribution' => $deviceStatusDistribution,
            'roomDistribution' => $roomDistribution,
            'recentAlerts' => $recentAlerts,
            'recentDevices' => $recentDevices,
            'categoryDistribution' => $categoryDistribution,
            'deviceTypes' => $deviceTypes,
            'breadcrumbs' => [
                ['title' => __('navigation.dashboard'), 'href' => '/dashboard'],
            ],
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
                'label' => __('dashboard.totalRooms'),
                'icon' => 'Building2',
                'color' => 'blue',
                'href' => '/rooms',
            ],
            'racks' => [
                'total' => Rack::count(),
                'label' => __('dashboard.totalRacks'),
                'icon' => 'Server',
                'color' => 'indigo',
                'href' => '/racks',
            ],
            'devices' => [
                'total' => Device::count(),
                'online' => $deviceStats['online'] ?? 0,
                'offline' => $deviceStats['offline'] ?? 0,
                'maintenance' => $deviceStats['maintenance'] ?? 0,
                'label' => __('dashboard.totalDevices'),
                'icon' => 'Cpu',
                'color' => 'green',
                'href' => '/devices',
            ],
            'alerts' => [
                'total' => $activeAlerts,
                'critical' => Alert::ofSeverity('critical')->active()->count(),
                'warning' => Alert::ofSeverity('warning')->active()->count(),
                'label' => __('dashboard.activeAlerts'),
                'icon' => 'AlertTriangle',
                'color' => 'red',
                'href' => '/alerts',
            ],
            'power' => [
                'total' => $totalPower,
                'label' => __('dashboard.totalPower'),
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
        return Device::with(['rack.room', 'deviceLibrary.deviceType'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($device) => [
                'id' => $device->id,
                'name' => $device->name,
                'status' => $device->status,
                'device_type_id' => $device->deviceLibrary?->device_type_id,
                'room_name' => $device->rack?->room?->name,
                'created_at' => $device->created_at->diffForHumans(),
            ])
            ->toArray();
    }

    /**
     * 获取设备类型列表
     */
    private function getDeviceTypes(): array
    {
        return DeviceType::all()
            ->map(fn ($type) => [
                'id' => $type->id,
                'name' => $type->name,
                'icon' => $type->icon,
                'color' => $type->color,
            ])
            ->toArray();
    }

    /**
     * 显示机柜智能分析页面
     */
    public function rackAnalysis(): Response
    {
        $rooms = Room::select('id', 'name')->get();
        $racks = Rack::with('room')
            ->orderBy('room_id')
            ->orderBy('name')
            ->get()
            ->map(fn ($rack) => [
                'id' => $rack->id,
                'name' => $rack->name,
                'room_id' => $rack->room_id,
                'u_count' => $rack->u_count,
            ]);

        return inertia('Rack/RackAnalysis', [
            'rooms' => $rooms,
            'racks' => $racks,
            'breadcrumbs' => [
                ['title' => __('navigation.monitorReports'), 'href' => '#'],
                ['title' => '机柜智能分析', 'href' => '/rack-analysis'],
            ],
        ]);
    }

    /**
     * 显示驾驶舱仪表盘页面
     */
    public function cockpit(): Response
    {
        $data = $this->getCockpitData();

        return inertia('Cockpit', [
            'data' => $data,
        ]);
    }

    /**
     * 获取驾驶舱数据
     */
    private function getCockpitData(): array
    {
        $deviceStats = Device::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $totalPower = Device::sum('power');
        $activeAlerts = Alert::active()->count();

        return [
            'summary' => [
                'rooms' => Room::count(),
                'racks' => Rack::count(),
                'devices' => Device::count(),
                'alerts' => $activeAlerts,
                'power' => $totalPower,
                'onlineDevices' => $deviceStats['online'] ?? 0,
                'offlineDevices' => $deviceStats['offline'] ?? 0,
                'maintenanceDevices' => $deviceStats['maintenance'] ?? 0,
                'criticalAlerts' => Alert::ofSeverity('critical')->active()->count(),
                'warningAlerts' => Alert::ofSeverity('warning')->active()->count(),
            ],
            'deviceStatus' => [
                'online' => $deviceStats['online'] ?? 0,
                'offline' => $deviceStats['offline'] ?? 0,
                'maintenance' => $deviceStats['maintenance'] ?? 0,
                'total' => Device::count(),
            ],
            'roomStats' => Room::withCount(['racks', 'devices'])
                ->get()
                ->map(fn ($room) => [
                    'id' => $room->id,
                    'name' => $room->name,
                    'racks' => $room->racks_count,
                    'devices' => $room->devices_count,
                    'temperature' => $room->current_temperature ?? '--',
                    'humidity' => $room->current_humidity ?? '--',
                ])
                ->toArray(),
            'recentAlerts' => Alert::active()
                ->orderByDesc('triggered_at')
                ->limit(8)
                ->get()
                ->map(fn ($alert) => [
                    'id' => $alert->id,
                    'title' => $alert->title,
                    'severity' => $alert->severity,
                    'triggered_at' => $alert->triggered_at->format('m-d H:i'),
                ])
                ->toArray(),
            'deviceTypes' => DeviceType::all()
                ->map(fn ($type) => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'color' => $type->color ?? '#3b82f6',
                    'count' => Device::where('device_type_id', $type->id)->count(),
                ])
                ->toArray(),
            'timestamp' => now()->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * 获取驾驶舱实时数据（API）
     */
    public function cockpitData()
    {
        return response()->json([
            'success' => true,
            'data' => $this->getCockpitData(),
        ]);
    }
}
