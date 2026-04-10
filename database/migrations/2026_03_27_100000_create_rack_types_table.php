<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rack_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('类型名称');
            $table->integer('u_count')->comment('U数');
            $table->integer('power')->comment('功率(W)');
            $table->text('description')->nullable()->comment('描述');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rack_types');
    }
};