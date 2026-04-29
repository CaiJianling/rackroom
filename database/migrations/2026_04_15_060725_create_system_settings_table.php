<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-04-15 14:07:25
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-04-29 12:40:13
 * @FilePath: /rackroom/database/migrations/2026_04_15_060725_create_system_settings_table.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

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
