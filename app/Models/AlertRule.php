<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AlertRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'rule_type',
        'condition',
        'condition_value',
        'severity',
        'is_enabled',
        'suggestion',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
    ];

    public const RULE_TYPES = [
        'power_overload' => '电源负载预警',
        'health_decline' => '健康度下降',
        'temperature_high' => '温度过高',
        'rack_capacity' => '机柜容量预警',
        'device_offline' => '设备离线',
    ];

    public const CONDITIONS = [
        'gt' => '大于',
        'gte' => '大于等于',
        'lt' => '小于',
        'lte' => '小于等于',
        'eq' => '等于',
        'not_eq' => '不等于',
    ];

    public const SEVERITIES = [
        'critical' => '严重',
        'warning' => '警告',
        'info' => '信息',
    ];

    public function executions(): HasMany
    {
        return $this->hasMany(AlertRuleExecution::class);
    }

    public function evaluate(mixed $value): bool
    {
        $condition = $this->condition;
        $threshold = (float) $this->condition_value;
        $actualValue = (float) $value;

        return match ($condition) {
            'gt' => $actualValue > $threshold,
            'gte' => $actualValue >= $threshold,
            'lt' => $actualValue < $threshold,
            'lte' => $actualValue <= $threshold,
            'eq' => $actualValue == $threshold,
            'not_eq' => $actualValue != $threshold,
            default => false,
        };
    }
}