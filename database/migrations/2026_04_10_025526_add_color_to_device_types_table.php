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
        Schema::table('device_types', function (Blueprint $table) {
            $table->string('color')->nullable()->after('icon')->comment('颜色RGB值，如#FF5733');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('device_types', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
