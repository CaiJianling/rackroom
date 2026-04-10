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
        Schema::create('generated_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->nullable()->constrained('report_templates')->nullOnDelete();
            $table->string('name');
            $table->string('report_type');
            $table->json('filters'); // 实际使用的筛选条件
            $table->json('parameters');
            $table->string('format'); // pdf, excel, csv, html
            $table->string('file_path')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignId('generated_by')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('processing'); // processing, completed, failed
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('generated_reports');
    }
};
