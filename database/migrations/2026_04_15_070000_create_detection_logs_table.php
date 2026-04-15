<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('detection_logs', function (Blueprint $table) {
            $table->id();
            $table->string('type')->default('auto'); // auto: 自动检测, manual: 手动检测
            $table->integer('total_devices')->default(0);
            $table->integer('online_count')->default(0);
            $table->integer('offline_count')->default(0);
            $table->integer('maintenance_count')->default(0);
            $table->integer('updated_count')->default(0); // 状态发生变化的设备数
            $table->integer('duration_ms')->default(0); // 执行耗时(毫秒)
            $table->text('details')->nullable(); // 详细结果JSON
            $table->string('status')->default('success'); // success, failed, skipped
            $table->string('message')->nullable(); // 执行消息
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'created_at']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('detection_logs');
    }
};
