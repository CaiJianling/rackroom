<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_change_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained()->onDelete('cascade');
            $table->string('change_type', 50);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('old_rack_name')->nullable();
            $table->string('new_rack_name')->nullable();
            $table->integer('old_u_position')->nullable();
            $table->integer('new_u_position')->nullable();
            $table->text('description')->nullable();
            $table->string('operator_name')->nullable();
            $table->string('operator_ip')->nullable();
            $table->timestamps();

            $indexes = [
                ['device_id', 'device_change_logs_device_id_index'],
                ['change_type', 'device_change_logs_change_type_index'],
                ['created_at', 'device_change_logs_created_at_index'],
            ];
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_change_logs');
    }
};
