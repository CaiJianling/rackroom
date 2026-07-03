<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceChangeLog extends Model
{
    protected $fillable = [
        'device_id',
        'change_type',
        'old_values',
        'new_values',
        'old_rack_name',
        'new_rack_name',
        'old_u_position',
        'new_u_position',
        'description',
        'operator_name',
        'operator_ip',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'old_u_position' => 'integer',
        'new_u_position' => 'integer',
        'device_id' => 'integer',
    ];

    public const TYPE_CREATE = 'create';
    public const TYPE_UPDATE = 'update';
    public const TYPE_DELETE = 'delete';
    public const TYPE_MIGRATE = 'migrate';
    public const TYPE_POWER_ON = 'power_on';
    public const TYPE_POWER_OFF = 'power_off';
    public const TYPE_MAINTENANCE = 'maintenance';

    public const TYPE_LABELS = [
        self::TYPE_CREATE => '创建',
        self::TYPE_UPDATE => '更新',
        self::TYPE_DELETE => '删除',
        self::TYPE_MIGRATE => '迁移',
        self::TYPE_POWER_ON => '开机',
        self::TYPE_POWER_OFF => '关机',
        self::TYPE_MAINTENANCE => '维护',
    ];

    public const TYPE_COLORS = [
        self::TYPE_CREATE => 'bg-green-100 text-green-800',
        self::TYPE_UPDATE => 'bg-blue-100 text-blue-800',
        self::TYPE_DELETE => 'bg-red-100 text-red-800',
        self::TYPE_MIGRATE => 'bg-purple-100 text-purple-800',
        self::TYPE_POWER_ON => 'bg-emerald-100 text-emerald-800',
        self::TYPE_POWER_OFF => 'bg-orange-100 text-orange-800',
        self::TYPE_MAINTENANCE => 'bg-yellow-100 text-yellow-800',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public static function log(
        Device $device,
        string $changeType,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $description = null,
        ?string $operatorName = null
    ): self {
        $oldRackName = $oldValues['rack_name'] ?? null;
        $newRackName = $newValues['rack_name'] ?? null;
        $oldUPosition = $oldValues['u_position'] ?? null;
        $newUPosition = $newValues['u_position'] ?? null;

        if ($oldUPosition && isset($oldValues['u_height'])) {
            $oldUPosition = $oldUPosition . '-' . ($oldUPosition + $oldValues['u_height'] - 1);
        }
        if ($newUPosition && isset($newValues['u_height'])) {
            $newUPosition = $newUPosition . '-' . ($newUPosition + $newValues['u_height'] - 1);
        }

        $operatorName = $operatorName ?: (\Illuminate\Support\Facades\Auth::user()?->name ?: 'System');

        \Illuminate\Support\Facades\Log::info('DeviceChangeLog about to create', [
            'device_id' => $device->id,
            'change_type' => $changeType,
            'description' => $description,
        ]);

        try {
            $log = self::create([
                'device_id' => $device->id,
                'change_type' => $changeType,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'old_rack_name' => $oldRackName,
                'new_rack_name' => $newRackName,
                'old_u_position' => is_numeric($oldUPosition) ? $oldUPosition : null,
                'new_u_position' => is_numeric($newUPosition) ? $newUPosition : null,
                'description' => $description,
                'operator_name' => $operatorName,
                'operator_ip' => request()->ip(),
            ]);

            \Illuminate\Support\Facades\Log::info('DeviceChangeLog created successfully', ['log_id' => $log->id]);

            return $log;
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('DeviceChangeLog create failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public static function logMigration(
        Device $device,
        string $oldRackName,
        int $oldUPosition,
        string $newRackName,
        int $newUPosition,
        ?string $description = null
    ): self {
        return self::log(
            $device,
            self::TYPE_MIGRATE,
            [
                'name' => $device->name,
                'rack_name' => $oldRackName,
                'u_position' => $oldUPosition,
            ],
            [
                'name' => $device->name,
                'rack_name' => $newRackName,
                'u_position' => $newUPosition,
            ],
            $description ?? "设备从 {$oldRackName} (U{$oldUPosition}) 迁移至 {$newRackName} (U{$newUPosition})"
        );
    }

    public static function logCreate(Device $device, ?string $description = null): self
    {
        $rackName = $device->rack?->name ?? '未知';
        return self::log(
            $device,
            self::TYPE_CREATE,
            null,
            $device->toArray(),
            $description ?? ('在 ' . $rackName . ' (U' . $device->u_position . ') 创建设备')
        );
    }

    public static function logUpdate(Device $device, array $oldValues, array $newValues, ?string $description = null): self
    {
        $changes = [];
        foreach ($newValues as $key => $value) {
            if (isset($oldValues[$key]) && $oldValues[$key] !== $value) {
                $changes[] = $key . ': ' . $oldValues[$key] . ' → ' . $value;
            }
        }

        return self::log(
            $device,
            self::TYPE_UPDATE,
            $oldValues,
            $newValues,
            $description ?? ('设备配置变更: ' . implode(', ', $changes))
        );
    }

    public static function logDelete(Device $device, ?string $description = null): self
    {
        return self::log(
            $device,
            self::TYPE_DELETE,
            $device->toArray(),
            null,
            $description ?? ('删除设备 ' . $device->name)
        );
    }
}
