<?php

namespace Database\Seeders;

use App\Models\AlertRule;
use Illuminate\Database\Seeder;

class AlertRuleSeeder extends Seeder
{
    public function run(): void
    {
        $rules = [
            [
                'name' => '电源负载预警',
                'description' => '设备电源负载超过80%时触发告警',
                'rule_type' => 'power_overload',
                'condition' => 'gt',
                'condition_value' => 80,
                'severity' => 'warning',
                'is_enabled' => true,
                'suggestion' => '建议将设备迁移到负载较低的机柜或升级电源模块',
            ],
            [
                'name' => '健康度下降告警',
                'description' => '设备健康度低于60%时触发告警',
                'rule_type' => 'health_decline',
                'condition' => 'lt',
                'condition_value' => 60,
                'severity' => 'critical',
                'is_enabled' => true,
                'suggestion' => '建议立即检查设备状态，可能是网络不稳定或硬件故障',
            ],
            [
                'name' => '温度过高告警',
                'description' => '设备温度超过40°C时触发告警',
                'rule_type' => 'temperature_high',
                'condition' => 'gt',
                'condition_value' => 40,
                'severity' => 'warning',
                'is_enabled' => true,
                'suggestion' => '建议检查设备散热系统或调整机房温湿度',
            ],
            [
                'name' => '机柜容量预警',
                'description' => '机柜容量超过80%时触发告警',
                'rule_type' => 'rack_capacity',
                'condition' => 'gt',
                'condition_value' => 80,
                'severity' => 'warning',
                'is_enabled' => true,
                'suggestion' => '建议将部分设备迁移到其他机柜以分散负载',
            ],
            [
                'name' => '设备离线告警',
                'description' => '设备离线时立即触发告警',
                'rule_type' => 'device_offline',
                'condition' => 'eq',
                'condition_value' => 1,
                'severity' => 'critical',
                'is_enabled' => true,
                'suggestion' => '请检查设备电源、网络连接或物理设备状态',
            ],
        ];

        foreach ($rules as $rule) {
            AlertRule::create($rule);
        }
    }
}
