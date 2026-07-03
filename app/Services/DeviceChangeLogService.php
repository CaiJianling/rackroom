<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceChangeLog;
use Illuminate\Support\Collection;

class DeviceChangeLogService
{
    public function getLogs(array $filters = [], int $perPage = 20): array
    {
        $query = DeviceChangeLog::with('device')
            ->orderBy('created_at', 'desc');

        if (!empty($filters['device_id'])) {
            $query->where('device_id', $filters['device_id']);
        }

        if (!empty($filters['change_type'])) {
            $query->where('change_type', $filters['change_type']);
        }

        if (!empty($filters['rack_id'])) {
            $query->where(function ($q) use ($filters) {
                $q->whereJsonContains('old_values', ['rack_id' => $filters['rack_id']])
                    ->orWhereJsonContains('new_values', ['rack_id' => $filters['rack_id']]);
            });
        }

        if (!empty($filters['operator_name'])) {
            $query->where('operator_name', 'like', '%' . $filters['operator_name'] . '%');
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        $logs = $query->paginate($perPage);

        return [
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ];
    }

    public function getDeviceHistory(int $deviceId): array
    {
        $device = Device::with('rack', 'deviceLibrary')->findOrFail($deviceId);

        $logs = DeviceChangeLog::where('device_id', $deviceId)
            ->orderBy('created_at', 'desc')
            ->get();

        $timeline = [];
        foreach ($logs as $log) {
            $timeline[] = [
                'id' => $log->id,
                'type' => $log->change_type,
                'type_label' => DeviceChangeLog::TYPE_LABELS[$log->change_type] ?? $log->change_type,
                'type_color' => DeviceChangeLog::TYPE_COLORS[$log->change_type] ?? 'bg-gray-100 text-gray-800',
                'description' => $log->description,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'old_rack' => $log->old_rack_name,
                'new_rack' => $log->new_rack_name,
                'old_position' => $log->old_u_position,
                'new_position' => $log->new_u_position,
                'operator' => $log->operator_name,
                'ip' => $log->operator_ip,
                'timestamp' => $log->created_at->toIso8601String(),
                'created_at' => $log->created_at->format('Y-m-d H:i:s'),
            ];
        }

        $statistics = $this->calculateDeviceStatistics($deviceId);

        return [
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'rack_name' => $device->rack?->name,
                'u_position' => $device->u_position,
                'device_library_name' => $device->deviceLibrary?->name,
            ],
            'timeline' => $timeline,
            'statistics' => $statistics,
        ];
    }

    private function calculateDeviceStatistics(int $deviceId): array
    {
        $logs = DeviceChangeLog::where('device_id', $deviceId)->get();

        $typeCount = [];
        foreach (DeviceChangeLog::TYPE_LABELS as $type => $label) {
            $typeCount[$type] = $logs->where('change_type', $type)->count();
        }

        $firstLog = $logs->sortBy('created_at')->first();
        $lastLog = $logs->sortByDesc('created_at')->first();

        $migrations = $logs->where('change_type', DeviceChangeLog::TYPE_MIGRATE);

        return [
            'total_changes' => $logs->count(),
            'change_types' => $typeCount,
            'migration_count' => $migrations->count(),
            'first_change_at' => $firstLog?->created_at?->format('Y-m-d H:i:s'),
            'last_change_at' => $lastLog?->created_at?->format('Y-m-d H:i:s'),
            'migration_history' => $migrations->map(function ($log) {
                return [
                    'from' => $log->old_rack_name,
                    'from_position' => $log->old_u_position,
                    'to' => $log->new_rack_name,
                    'to_position' => $log->new_u_position,
                    'at' => $log->created_at->format('Y-m-d H:i:s'),
                    'operator' => $log->operator_name,
                ];
            })->values()->toArray(),
        ];
    }

    public function getMigrationRecords(array $filters = [], int $perPage = 20): array
    {
        $query = DeviceChangeLog::with('device')
            ->where('change_type', DeviceChangeLog::TYPE_MIGRATE)
            ->orderBy('created_at', 'desc');

        if (!empty($filters['from_rack'])) {
            $query->where('old_rack_name', 'like', '%' . $filters['from_rack'] . '%');
        }

        if (!empty($filters['to_rack'])) {
            $query->where('new_rack_name', 'like', '%' . $filters['to_rack'] . '%');
        }

        if (!empty($filters['device_name'])) {
            $query->whereHas('device', function ($q) use ($filters) {
                $q->where('name', 'like', '%' . $filters['device_name'] . '%');
            });
        }

        if (!empty($filters['operator'])) {
            $query->where('operator_name', 'like', '%' . $filters['operator'] . '%');
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        $logs = $query->paginate($perPage);

        return [
            'data' => collect($logs->items())->map(function ($log) {
                $oldValues = is_array($log->old_values) ? $log->old_values : [];
                $newValues = is_array($log->new_values) ? $log->new_values : [];
                $deviceName = $log->device?->name
                    ?? ($oldValues['name'] ?? null)
                    ?? ($newValues['name'] ?? null)
                    ?? '未知设备';

                return [
                    'id' => $log->id,
                    'device_id' => $log->device_id,
                    'device_name' => $deviceName,
                    'from_rack' => $log->old_rack_name ?? ($oldValues['rack_name'] ?? null),
                    'from_position' => $log->old_u_position ?? ($oldValues['u_position'] ?? null),
                    'to_rack' => $log->new_rack_name ?? ($newValues['rack_name'] ?? null),
                    'to_position' => $log->new_u_position ?? ($newValues['u_position'] ?? null),
                    'description' => $log->description,
                    'operator' => $log->operator_name,
                    'ip' => $log->operator_ip,
                    'timestamp' => $log->created_at->toIso8601String(),
                ];
            })->toArray(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ];
    }

    public function getStatistics(): array
    {
        $totalLogs = DeviceChangeLog::count();
        $totalMigrations = DeviceChangeLog::where('change_type', DeviceChangeLog::TYPE_MIGRATE)->count();
        $totalUpdates = DeviceChangeLog::where('change_type', DeviceChangeLog::TYPE_UPDATE)->count();
        $totalCreates = DeviceChangeLog::where('change_type', DeviceChangeLog::TYPE_CREATE)->count();
        $totalDeletes = DeviceChangeLog::where('change_type', DeviceChangeLog::TYPE_DELETE)->count();

        $recentLogs = DeviceChangeLog::with('device')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($log) {
                $oldValues = is_array($log->old_values) ? $log->old_values : [];
                $newValues = is_array($log->new_values) ? $log->new_values : [];
                $deviceName = $log->device?->name
                    ?? ($oldValues['name'] ?? null)
                    ?? ($newValues['name'] ?? null)
                    ?? '未知设备';

                return [
                    'id' => $log->id,
                    'device_name' => $deviceName,
                    'type' => $log->change_type,
                    'type_label' => DeviceChangeLog::TYPE_LABELS[$log->change_type] ?? $log->change_type,
                    'description' => $log->description,
                    'operator' => $log->operator_name,
                    'timestamp' => $log->created_at->format('Y-m-d H:i:s'),
                ];
            });

        $operatorStats = DeviceChangeLog::selectRaw('operator_name, count(*) as count')
            ->groupBy('operator_name')
            ->orderByDesc('count')
            ->limit(10)
            ->get()
            ->map(function ($stat) {
                return [
                    'operator' => $stat->operator_name,
                    'count' => $stat->count,
                ];
            });

        $typeDistribution = [];
        foreach (DeviceChangeLog::TYPE_LABELS as $type => $label) {
            $typeDistribution[] = [
                'type' => $type,
                'label' => $label,
                'count' => DeviceChangeLog::where('change_type', $type)->count(),
            ];
        }

        return [
            'total_logs' => $totalLogs,
            'total_migrations' => $totalMigrations,
            'total_updates' => $totalUpdates,
            'total_creates' => $totalCreates,
            'total_deletes' => $totalDeletes,
            'recent_logs' => $recentLogs,
            'operator_stats' => $operatorStats,
            'type_distribution' => $typeDistribution,
        ];
    }

    public function getChangeTypeOptions(): array
    {
        return array_map(function ($type, $label) {
            return [
                'value' => $type,
                'label' => $label,
            ];
        }, array_keys(DeviceChangeLog::TYPE_LABELS), DeviceChangeLog::TYPE_LABELS);
    }
}
