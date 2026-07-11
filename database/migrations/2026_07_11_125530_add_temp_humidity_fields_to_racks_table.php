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
        Schema::table('racks', function (Blueprint $table) {
            $table->string('temp_humidity_url')->nullable()->comment('温湿度控制器URL地址');
            $table->decimal('current_temp', 5, 2)->nullable()->comment('当前温度');
            $table->decimal('current_humidity', 5, 2)->nullable()->comment('当前湿度');
            $table->timestamp('temp_humidity_updated_at')->nullable()->comment('温湿度最后更新时间');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('racks', function (Blueprint $table) {
            $table->dropColumn([
                'temp_humidity_url',
                'current_temp',
                'current_humidity',
                'temp_humidity_updated_at',
            ]);
        });
    }
};
