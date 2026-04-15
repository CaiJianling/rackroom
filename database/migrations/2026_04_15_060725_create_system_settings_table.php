<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->string('type')->default('string'); // string, boolean, integer, json
            $table->string('description')->nullable();
            $table->timestamps();

            $table->index('key');
        });

        // 插入默认设置
        DB::table('system_settings')->insert([
            [
                'key' => 'auto_detection_enabled',
                'value' => json_encode(true),
                'type' => 'boolean',
                'description' => '自动检测功能开关',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'auto_detection_interval',
                'value' => json_encode(5),
                'type' => 'integer',
                'description' => '自动检测时间间隔（分钟）',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
