<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-25 03:55:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 20:51:44
 * @FilePath: /rackroom/routes/web.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-25 03:55:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-26 13:46:06
 * @FilePath: /rackroom/routes/web.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

use App\Http\Controllers\AlertController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DataExportController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\DeviceLibraryController;
use App\Http\Controllers\DeviceTypeController;
use App\Http\Controllers\MonitorController;
use App\Http\Controllers\PingController;
use App\Http\Controllers\RackController;
use App\Http\Controllers\RackTypeController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('users', UserController::class);
    Route::put('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    Route::resource('rooms', RoomController::class);
    Route::resource('rack-types', RackTypeController::class);
    Route::get('racks/visual-edit', [RackController::class, 'visualEdit'])->name('racks.visual-edit');
    Route::resource('racks', RackController::class);
    Route::resource('device-types', DeviceTypeController::class);
    Route::resource('device-library', DeviceLibraryController::class);
    Route::resource('devices', DeviceController::class);
    Route::get('devices/export', [DeviceController::class, 'export'])->name('devices.export');
    Route::post('devices/import', [DeviceController::class, 'import'])->name('devices.import');

    // 数据导出导入路由
    Route::get('data/export', [DataExportController::class, 'export'])->name('data.export');
    Route::post('data/import-preview', [DataExportController::class, 'preview'])->name('data.import-preview');
    Route::post('data/import', [DataExportController::class, 'import'])->name('data.import');

    // Ping 检测路由
    Route::post('ping/batch', [PingController::class, 'batchPing'])->name('ping.batch');
    Route::post('ping/device/{device}', [PingController::class, 'pingDevice'])->name('ping.device');

    // 备份管理路由
    Route::get('backup', [BackupController::class, 'index'])->name('backup.index');
    Route::post('backup', [BackupController::class, 'create'])->name('backup.create');
    Route::get('backup/{id}', [BackupController::class, 'show'])->name('backup.show');
    Route::get('backup/{id}/download', [BackupController::class, 'download'])->name('backup.download');
    Route::post('backup/{id}/restore', [BackupController::class, 'restore'])->name('backup.restore');
    Route::delete('backup/{id}', [BackupController::class, 'destroy'])->name('backup.destroy');
    Route::post('backup/upload', [BackupController::class, 'upload'])->name('backup.upload');

    // 监控/报表路由
    Route::get('monitor', [MonitorController::class, 'index'])->name('monitor.index');
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('alerts', [AlertController::class, 'index'])->name('alerts.index');

    // 监控/报表 API 路由（使用 web 中间件共享 session）
    Route::prefix('api')->group(function () {
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
    });
});

require __DIR__.'/settings.php';
