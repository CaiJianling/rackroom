<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeneratedReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'name',
        'report_type',
        'filters',
        'parameters',
        'format',
        'file_path',
        'file_size',
        'generated_by',
        'status',
        'started_at',
        'completed_at',
        'error_message',
    ];

    protected $casts = [
        'filters' => 'array',
        'parameters' => 'array',
        'file_size' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /**
     * 获取模板
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ReportTemplate::class, 'template_id');
    }

    /**
     * 获取生成用户
     */
    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    /**
     * 作用域：按状态
     */
    public function scopeOfStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * 作用域：按用户
     */
    public function scopeByUser($query, int $userId)
    {
        return $query->where('generated_by', $userId);
    }

    /**
     * 标记为完成
     */
    public function markAsCompleted(string $filePath, int $fileSize): void
    {
        $this->update([
            'status' => 'completed',
            'file_path' => $filePath,
            'file_size' => $fileSize,
            'completed_at' => now(),
        ]);
    }

    /**
     * 标记为失败
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'completed_at' => now(),
        ]);
    }

    /**
     * 获取文件大小（人类可读）
     */
    public function getFileSizeForHumansAttribute(): string
    {
        if (! $this->file_size) {
            return '-';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $size = $this->file_size;
        $unitIndex = 0;

        while ($size >= 1024 && $unitIndex < count($units) - 1) {
            $size /= 1024;
            $unitIndex++;
        }

        return round($size, 2).' '.$units[$unitIndex];
    }
}
