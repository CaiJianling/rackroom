<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('device_change_logs', function (Blueprint $table) {
            // 移除原有的外键约束（cascade）
            // 变更日志需要独立保存，不应因设备删除而消失
            $table->dropForeign(['device_id']);

            // 将 device_id 改为普通整数字段，不设置外键
            $table->unsignedBigInteger('device_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('device_change_logs', function (Blueprint $table) {
            $table->dropForeign(['device_id']);
            $table->foreignId('device_id')->constrained()->onDelete('cascade');
        });
    }
};
