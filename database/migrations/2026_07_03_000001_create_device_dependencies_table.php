<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_device_id')->constrained('devices')->onDelete('cascade');
            $table->foreignId('target_device_id')->constrained('devices')->onDelete('cascade');
            $table->enum('dependency_type', ['network', 'power', 'storage', 'application', 'other'])
                ->default('network')
                ->comment('依赖类型: network=网络连接, power=电源连接, storage=存储连接, application=应用依赖, other=其他');
            $table->string('description')->nullable()->comment('依赖描述');
            $table->timestamps();

            $table->unique(['source_device_id', 'target_device_id', 'dependency_type'], 'unique_device_dependency');
            $table->index('source_device_id');
            $table->index('target_device_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_dependencies');
    }
};
