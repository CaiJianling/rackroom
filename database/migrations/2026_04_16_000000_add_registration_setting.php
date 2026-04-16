<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 插入注册开关设置
        DB::table('system_settings')->insertOrIgnore([
            [
                'key' => 'registration_enabled',
                'value' => json_encode(true),
                'type' => 'boolean',
                'description' => '允许用户注册功能开关',
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
        DB::table('system_settings')->where('key', 'registration_enabled')->delete();
    }
};
