<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Alert extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'severity',
        'status',
        'alert_type',
        'resource_type',
        'resource_id',
        'metadata',
        'triggered_at',
        'acknowledged_at',
        'acknowledged_by',
        'resolved_at',
        'resolved_by',
        'resolution_note',
    ];

    protected $casts = [
        'metadata' => 'array',
        'triggered_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    /**
     * 获取告警关联的资源
     */
    public function resource(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'resource_type', 'resource_id');
    }

    /**
     * 获取确认用户
     */
    public function acknowledgedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    /**
     * 获取解决用户
     */
    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * 作用域：活跃告警
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * 作用域：按严重级别
     */
    public function scopeOfSeverity($query, string $severity)
    {
        return $query->where('severity', $severity);
    }

    /**
     * 作用域：按状态
     */
    public function scopeOfStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * 作用域：按资源类型
     */
    public function scopeForResource($query, string $type, ?int $id = null)
    {
        $query = $query->where('resource_type', $type);
        if ($id !== null) {
            $query->where('resource_id', $id);
        }

        return $query;
    }

    /**
     * 确认告警
     */
    public function acknowledge(int $userId): void
    {
        $this->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
            'acknowledged_by' => $userId,
        ]);
    }

    /**
     * 解决告警
     */
    public function resolve(int $userId, ?string $note = null): void
    {
        $this->update([
            'status' => 'resolved',
            'resolved_at' => now(),
            'resolved_by' => $userId,
            'resolution_note' => $note,
        ]);
    }

    /**
     * 获取严重级别颜色
     */
    public function getSeverityColorAttribute(): string
    {
        return match ($this->severity) {
            'critical' => 'red',
            'warning' => 'orange',
            'info' => 'blue',
            default => 'gray',
        };
    }
}
