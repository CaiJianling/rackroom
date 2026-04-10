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
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rack_id')->nullable()->constrained()->onDelete('set null');
            $table->string('name');
            $table->string('category')->default('server')->comment('设备分类');
            $table->string('model')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('serial_number')->nullable();
            $table->integer('u_position')->default(1)->comment('U位置');
            $table->integer('power')->default(0)->comment('功率(W)');
            $table->string('status')->default('online')->comment('状态');
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
