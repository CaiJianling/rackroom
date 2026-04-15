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
        Schema::create('h3c_password_change_logs', function (Blueprint $table) {
            $table->id();
            $table->string('ip_address')->comment('交换机IP地址');
            $table->integer('port')->default(22)->comment('SSH端口');
            $table->string('username')->comment('用户名');
            $table->string('status')->comment('状态：成功/失败');
            $table->text('message')->comment('日志消息');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->timestamp('executed_at');
            $table->timestamps();

            $table->index('ip_address');
            $table->index('status');
            $table->index('executed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('h3c_password_change_logs');
    }
};
