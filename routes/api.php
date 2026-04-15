<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-04-10 00:00:00
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-04-10 00:00:00
 * @FilePath: /rackroom/routes/api.php
 * @Description: API Routes
 */

use App\Http\Controllers\AlertController;
use App\Http\Controllers\DetectionLogController;
use App\Http\Controllers\MonitorController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// API routes that use session-based authentication
// Note: These routes require session cookies (credentials: 'same-origin' in fetch)
Route::middleware(['web', 'auth', 'verified'])->group(function () {
    // 监控API
    Route::get('monitor/stats', [MonitorController::class, 'stats']);
    Route::get('monitor/devices', [MonitorController::class, 'devices']);
    Route::get('monitor/device-status', [MonitorController::class, 'deviceStatus']);
    Route::get('monitor/room-distribution', [MonitorController::class, 'roomDistribution']);
    Route::get('monitor/alert-stats', [MonitorController::class, 'alertStats']);
    Route::get('monitor/metrics', [MonitorController::class, 'metrics']);

    // 告警API
    Route::get('alerts/{alert}', [AlertController::class, 'show']);
    Route::post('alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge']);
    Route::post('alerts/{alert}/resolve', [AlertController::class, 'resolve']);
    Route::post('alerts/batch-acknowledge', [AlertController::class, 'batchAcknowledge']);
    Route::post('alerts/batch-resolve', [AlertController::class, 'batchResolve']);
    Route::post('alerts', [AlertController::class, 'store']);

    // 报表API
    Route::post('reports/generate', [ReportController::class, 'generate']);
    Route::post('reports/preview', [ReportController::class, 'preview']);
    Route::post('reports/chart-data', [ReportController::class, 'chartData']);
    Route::post('reports/templates', [ReportController::class, 'saveTemplate']);
    Route::get('reports/{report}/download', [ReportController::class, 'download']);
    Route::delete('reports/{report}', [ReportController::class, 'destroy']);

    // 检测日志API
    Route::get('detection-logs', [DetectionLogController::class, 'index']);
    Route::get('detection-logs/stats', [DetectionLogController::class, 'stats']);
    Route::get('detection-logs/{log}', [DetectionLogController::class, 'show']);
    Route::post('detection-logs/detect', [DetectionLogController::class, 'detect']);
});
