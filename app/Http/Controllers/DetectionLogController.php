<?php

namespace App\Http\Controllers;

use App\Models\DetectionLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DetectionLogController extends Controller
{
    /**
     * 获取检测日志列表
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'limit' => 'nullable|integer|min:1|max:100',
            'type' => 'nullable|string|in:auto,manual',
        ]);

        $limit = $request->input('limit', 20);
        $type = $request->input('type');

        $query = DetectionLog::query();

        if ($type) {
            $query->where('type', $type);
        }

        $logs = $query->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($log) => [
                'id' => $log->id,
                'type' => $log->type,
                'total_devices' => $log->total_devices,
                'online_count' => $log->online_count,
                'offline_count' => $log->offline_count,
                'maintenance_count' => $log->maintenance_count,
                'updated_count' => $log->updated_count,
                'duration_ms' => $log->duration_ms,
                'status' => $log->status,
                'message' => $log->message,
                'created_at' => $log->created_at->toDateTimeString(),
                'completed_at' => $log->completed_at?->toDateTimeString(),
            ]);

        return response()->json([
            'success' => true,
            'logs' => $logs,
        ]);
    }

    /**
     * 获取检测统计信息
     */
    public function stats(): JsonResponse
    {
        // 最后一次检测
        $lastAuto = DetectionLog::getLastAuto();
        $lastAutoRun = DetectionLog::getLastAutoRun();
        $lastManual = DetectionLog::where('type', 'manual')
            ->where('status', 'success')
            ->orderByDesc('created_at')
            ->first();

        // 今日统计
        $todayStats = DetectionLog::getTodayStats();

        // 自动检测设置
        $enabled = SystemSetting::get('auto_detection_enabled', true);
        $interval = SystemSetting::get('auto_detection_interval', 5);

        // 计算下次检测时间
        $nextScheduledAt = null;
        if ($enabled && $lastAutoRun) {
            $nextScheduledAt = $lastAutoRun->created_at->clone()->addMinutes($interval);
            if ($nextScheduledAt->isPast()) {
                $nextScheduledAt = now()->addMinute(); // 如果已过，则下次将在1分钟内执行
            }
        }

        return response()->json([
            'success' => true,
            'stats' => [
                'auto_detection_enabled' => $enabled,
                'auto_detection_interval' => $interval,
                'last_auto_detection' => $lastAuto ? [
                    'created_at' => $lastAuto->created_at->toDateTimeString(),
                    'status' => $lastAuto->status,
                    'total_devices' => $lastAuto->total_devices,
                    'updated_count' => $lastAuto->updated_count,
                    'duration_ms' => $lastAuto->duration_ms,
                ] : null,
                'last_manual_detection' => $lastManual ? [
                    'created_at' => $lastManual->created_at->toDateTimeString(),
                    'status' => $lastManual->status,
                    'total_devices' => $lastManual->total_devices,
                    'updated_count' => $lastManual->updated_count,
                ] : null,
                'next_scheduled_at' => $nextScheduledAt?->toDateTimeString(),
                'today' => $todayStats,
            ],
        ]);
    }

    /**
     * 执行手动检测
     */
    public function detect(): JsonResponse
    {
        // 执行检测命令
        $output = [];
        $returnCode = 0;

        exec('php '.base_path('artisan').' devices:auto-detect --type=manual 2>&1', $output, $returnCode);

        if ($returnCode !== 0) {
            return response()->json([
                'success' => false,
                'message' => '检测执行失败: '.implode("\n", $output),
            ], 500);
        }

        // 获取最新的一次手动检测记录
        $log = DetectionLog::where('type', 'manual')
            ->orderByDesc('created_at')
            ->first();

        return response()->json([
            'success' => true,
            'message' => $log?->message ?? '检测完成',
            'detection' => $log ? [
                'total_devices' => $log->total_devices,
                'online_count' => $log->online_count,
                'offline_count' => $log->offline_count,
                'maintenance_count' => $log->maintenance_count,
                'updated_count' => $log->updated_count,
                'duration_ms' => $log->duration_ms,
            ] : null,
        ]);
    }

    /**
     * 获取检测日志详情
     */
    public function show(DetectionLog $log): JsonResponse
    {
        return response()->json([
            'success' => true,
            'log' => [
                'id' => $log->id,
                'type' => $log->type,
                'total_devices' => $log->total_devices,
                'online_count' => $log->online_count,
                'offline_count' => $log->offline_count,
                'maintenance_count' => $log->maintenance_count,
                'updated_count' => $log->updated_count,
                'duration_ms' => $log->duration_ms,
                'details' => $log->details,
                'status' => $log->status,
                'message' => $log->message,
                'started_at' => $log->started_at?->toDateTimeString(),
                'completed_at' => $log->completed_at?->toDateTimeString(),
                'created_at' => $log->created_at->toDateTimeString(),
            ],
        ]);
    }
}
