<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('rule_type');
            $table->string('condition');
            $table->string('condition_value');
            $table->string('severity');
            $table->boolean('is_enabled')->default(true);
            $table->string('suggestion')->nullable();
            $table->timestamps();
        });

        Schema::create('alert_rule_executions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_rule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('alert_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('trigger_value');
            $table->timestamp('triggered_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_rule_executions');
        Schema::dropIfExists('alert_rules');
    }
};
