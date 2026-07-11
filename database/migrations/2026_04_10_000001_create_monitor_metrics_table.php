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
        Schema::create('monitor_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('metric_type'); // cpu, memory, disk, network, temperature, etc.
            $table->string('resource_type'); // device, rack, room, system
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->decimal('value', 10, 2);
            $table->string('unit'); // %, °C, MB, GB, etc.
            $table->json('metadata')->nullable(); // 额外数据
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['metric_type', 'resource_type', 'resource_id']);
            $table->index('recorded_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('monitor_metrics');
    }
};
