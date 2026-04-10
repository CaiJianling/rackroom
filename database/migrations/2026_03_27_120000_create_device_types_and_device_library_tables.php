<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('icon')->nullable()->comment('图标');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('device_library', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_type_id')->constrained('device_types')->onDelete('cascade');
            $table->string('name');
            $table->string('model')->nullable();
            $table->string('manufacturer')->nullable();
            $table->integer('u_height')->default(1)->comment('U高度');
            $table->integer('power')->default(0)->comment('功率(W)');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->foreignId('device_library_id')->nullable()->constrained('device_library')->onDelete('set null')->after('rack_id');
            $table->string('connection_type')->nullable()->comment('连接方式')->after('power');
            $table->string('ip_address')->nullable()->comment('IP地址')->after('connection_type');
        });
    }

    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropForeign(['device_library_id']);
            $table->dropColumn(['device_library_id', 'connection_type', 'ip_address']);
        });
        Schema::dropIfExists('device_library');
        Schema::dropIfExists('device_types');
    }
};