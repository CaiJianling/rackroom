<?php

namespace App\Console\Commands;

use App\Models\DetectionLog;
use App\Models\SystemSetting;
use Illuminate\Console\Command;

class CheckSchedulerStatus extends Command
{
    protected $signature = 'scheduler:status';

    protected $description = '检查定时任务运行状态';

    public function handle(): int
    {
        $this->info('RackRoom 定时任务状态检查');
        $this->line('');

        // 检查自动检测设置
        $enabled = SystemSetting::get('auto_detection_enabled', true);
        $interval = SystemSetting::get('auto_detection_interval', 5);

        $this->info('自动检测配置:');
        $this->line('  状态: '.($enabled ? '<fg=green>已启用</>' : '<fg=red>已关闭</>'));
        $this->line("  间隔: {$interval} 分钟");
        $this->line('');

        // 检查最后检测记录
        $lastAuto = DetectionLog::getLastAuto();
        $lastRun = DetectionLog::getLastAutoRun();

        if ($lastRun) {
            $this->info('检测记录:');
            $this->line('  上次运行: '.$lastRun->created_at->diffForHumans());
            $this->line('  运行状态: '.$lastRun->status);

            if ($lastAuto && $lastAuto->id !== $lastRun->id) {
                $this->line('  上次成功: '.$lastAuto->created_at->diffForHumans());
            }

            // 计算下次检测时间
            if ($enabled) {
                $nextRun = $lastRun->created_at->clone()->addMinutes($interval);
                $this->line('');
                if ($nextRun->isPast()) {
                    $this->warn('  下次检测: <fg=green>即将执行</>');
                } else {
                    $this->line('  下次检测: '.$nextRun->diffForHumans());
                }
            }
        } else {
            $this->warn('尚无自动检测记录');
        }

        $this->line('');
        $this->info('提示: 如果定时任务未运行，请执行:');
        $this->line('  php artisan schedule:work');
        $this->line('');
        $this->info('或使用自动配置脚本:');
        $this->line('  bash scripts/setup-scheduler.sh');

        return self::SUCCESS;
    }
}
