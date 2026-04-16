<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DetectionLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'total_devices',
        'online_count',
        'offline_count',
        'maintenance_count',
        'updated_count',
        'duration_ms',
        'details',
        'status',
        'message',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'details' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /**
     * 获取最近的检测日志
     */
    public static function getRecent(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return self::orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * 获取最后一次自动检测（成功状态）
     */
    public static function getLastAuto(): ?self
    {
        return self::where('type', 'auto')
            ->where('status', 'success')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * 获取最后一次自动检测（任何状态，用于计算间隔）
     */
    public static function getLastAutoRun(): ?self
    {
        return self::where('type', 'auto')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * 获取今日检测统计
     */
    public static function getTodayStats(): array
    {
        $logs = self::whereDate('created_at', today())->get();

        return [
            'total' => $logs->count(),
            'success' => $logs->where('status', 'success')->count(),
            'failed' => $logs->where('status', 'failed')->count(),
            'total_updated' => $logs->sum('updated_count'),
        ];
    }
}
