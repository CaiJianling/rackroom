<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReportTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'report_type',
        'filters',
        'columns',
        'chart_config',
        'created_by',
        'is_shared',
    ];

    protected $casts = [
        'filters' => 'array',
        'columns' => 'array',
        'chart_config' => 'array',
        'is_shared' => 'boolean',
    ];

    /**
     * 获取创建用户
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * 获取生成的报表
     */
    public function generatedReports(): HasMany
    {
        return $this->hasMany(GeneratedReport::class, 'template_id');
    }

    /**
     * 作用域：共享模板
     */
    public function scopeShared($query)
    {
        return $query->where('is_shared', true);
    }

    /**
     * 作用域：按类型
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('report_type', $type);
    }

    /**
     * 作用域：用户可访问的模板
     */
    public function scopeAccessibleBy($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('created_by', $userId)
                ->orWhere('is_shared', true);
        });
    }
}
