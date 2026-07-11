<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitorMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'metric_type',
        'resource_type',
        'resource_id',
        'value',
        'unit',
        'metadata',
        'recorded_at',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'metadata' => 'array',
        'recorded_at' => 'datetime',
    ];

    /**
     * 获取指标关联的资源
     */
    public function resource(): BelongsTo
    {
        return $this->morphTo(__FUNCTION__, 'resource_type', 'resource_id');
    }

    /**
     * 获取设备指标
     */
    public function scopeForDevice($query, int $deviceId)
    {
        return $query->where('resource_type', 'device')
            ->where('resource_id', $deviceId);
    }

    /**
     * 获取特定类型的指标
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('metric_type', $type);
    }

    /**
     * 获取时间范围内的指标
     */
    public function scopeInTimeRange($query, $start, $end)
    {
        return $query->whereBetween('recorded_at', [$start, $end]);
    }

    /**
     * 获取最新的指标
     */
    public function scopeLatest($query, int $limit = 1)
    {
        return $query->orderByDesc('recorded_at')->limit($limit);
    }
}
