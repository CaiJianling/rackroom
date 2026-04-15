<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 设备自动检测定时任务
// 使用 everyMinute 调度，命令内部会根据 auto_detection_enabled 设置决定是否执行
Schedule::command('devices:auto-detect --type=auto')
    ->everyMinute()
    ->name('device-auto-detection')
    ->withoutOverlapping()
    ->onOneServer();
