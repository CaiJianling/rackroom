<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertRule;
use App\Models\AlertRuleExecution;
use App\Models\Device;
use App\Models\Rack;
use Illuminate\Support\Collection;

class SmartAlertService
{
    public function evaluateAllRules(): array
    {
        $results = [
            'triggered' => [],
            'suggestions' => [],
        ];

        $rules = AlertRule::where('is_enabled', true)->get();

        foreach ($rules as $rule) {
            $evaluation = $this->evaluateRule($rule);
            if ($evaluation['triggered']) {
                $results['triggered'][] = $evaluation;
            }
        }

        return $results;
    }

    public function evaluateRule(AlertRule $rule): array
    {
        $devices = $this->getDevicesForRuleType($rule->rule_type);

        foreach ($devices as $device) {
            $value = $this->getMetricValue($device, $rule->rule_type);
            if ($rule->evaluate($value)) {
                $alert = $this->createAlert($device, $rule, $value);
                $suggestion = $this->generateSuggestion($device, $rule, $value);

                return [
                    'triggered' => true,
                    'rule' => $rule,
                    'device' => $device,
                    'value' => $value,
                    'alert' => $alert,
                    'suggestion' => $suggestion,
                ];
            }
        }

        return ['triggered' => false];
    }

    private function getDevicesForRuleType(string $ruleType): Collection
    {
        return match ($ruleType) {
            'power_overload', 'health_decline', 'temperature_high', 'device_offline' => Device::with(['rack.room', 'deviceLibrary'])->get(),
            'rack_capacity' => Rack::with('room')->get(),
            default => collect(),
        };
    }

    private function getMetricValue(Device|Rack $entity, string $ruleType): float
    {
        if ($entity instanceof Rack) {
            if ($ruleType === 'rack_capacity') {
                $usedSlots = $entity->devices()->count();
                $totalSlots = $entity->slots ?? 42;

                return $totalSlots > 0 ? ($usedSlots / $totalSlots) * 100 : 0;
            }

            return 0;
        }

        return match ($ruleType) {
            'power_overload' => $this->calculatePowerLoadPercentage($entity),
            'health_decline' => $this->getHealthScore($entity),
            'temperature_high' => $entity->temperature ?? 25,
            'device_offline' => $entity->status === 'offline' ? 1 : 0,
            default => 0,
        };
    }

    private function calculatePowerLoadPercentage(Device $device): float
    {
        $maxPower = $device->deviceLibrary?->power ?? 500;
        $currentPower = $device->power ?? 0;
        if ($maxPower <= 0) {
            return 0;
        }

        return ($currentPower / $maxPower) * 100;
    }

    private function getHealthScore(Device $device): float
    {
        $healthService = new DeviceHealthAnalysisService;
        try {
            $analysis = $healthService->analyzeDeviceHealth($device->id);

            return $analysis['health_score'] ?? 100;
        } catch (\Exception $e) {
            return 100;
        }
    }

    private function createAlert(Device $device, AlertRule $rule, float $value): Alert
    {
        $alert = Alert::create([
            'title' => "{$rule->name} - {$device->name}",
            'description' => "设备 {$device->name} 触发了告警规则：{$rule->description}",
            'severity' => $rule->severity,
            'status' => 'active',
            'alert_type' => $rule->rule_type,
            'resource_type' => Device::class,
            'resource_id' => $device->id,
            'metadata' => [
                'rule_id' => $rule->id,
                'trigger_value' => $value,
                'threshold' => $rule->condition_value,
                'condition' => $rule->condition,
            ],
            'triggered_at' => now(),
        ]);

        AlertRuleExecution::create([
            'alert_rule_id' => $rule->id,
            'device_id' => $device->id,
            'alert_id' => $alert->id,
            'trigger_value' => (string) $value,
            'triggered_at' => now(),
        ]);

        return $alert;
    }

    private function generateSuggestion(Device $device, AlertRule $rule, float $value): array
    {
        return match ($rule->rule_type) {
            'power_overload' => $this->generatePowerOverloadSuggestion($device, $value),
            'health_decline' => $this->generateHealthDeclineSuggestion($device),
            'temperature_high' => $this->generateTemperatureSuggestion($device),
            'rack_capacity' => $this->generateRackCapacitySuggestion($device),
            'device_offline' => $this->generateDeviceOfflineSuggestion($device),
            default => [
                'title' => '建议操作',
                'description' => $rule->suggestion ?? '请检查设备状态',
                'action' => '查看详情',
            ],
        };
    }

    private function generatePowerOverloadSuggestion(Device $device, float $value): array
    {
        $otherRacks = Rack::with(['room', 'devices.deviceLibrary'])
            ->where('id', '!=', $device->rack_id)
            ->get()
            ->map(function ($rack) {
                $totalPower = $rack->devices->sum(fn ($d) => $d->deviceLibrary?->power ?? 100);
                $maxPower = ($rack->slots ?? 42) * 100;

                return [
                    'rack' => $rack,
                    'available_power' => $maxPower - $totalPower,
                    'utilization' => $maxPower > 0 ? ($totalPower / $maxPower) * 100 : 0,
                ];
            })
            ->filter(fn ($r) => $r['available_power'] > 100)
            ->sortBy('utilization');

        $bestRack = $otherRacks->first();

        if ($bestRack) {
            $utilization = number_format($bestRack['utilization'], 1);

            return [
                'title' => '负载均衡建议',
                'description' => "将 {$device->name} 迁移到 {$bestRack['rack']->name} ({$bestRack['rack']->room?->name}) 可以平衡负载。当前机柜利用率 {$utilization}%。",
                'action' => '查看可用机柜',
                'action_type' => 'migrate',
                'target_rack_id' => $bestRack['rack']->id,
            ];
        }

        $valStr = number_format($value, 1);

        return [
            'title' => '电源负载过高',
            'description' => "{$device->name} 当前功率负载 {$valStr}%，超过预设阈值。建议检查设备功耗或升级电源模块。",
            'action' => '查看设备详情',
            'action_type' => 'view',
        ];
    }

    private function generateHealthDeclineSuggestion(Device $device): array
    {
        $healthScore = $this->getHealthScore($device);
        $scoreStr = number_format($healthScore, 1);

        return [
            'title' => '健康度下降告警',
            'description' => "{$device->name} 当前健康度 {$scoreStr}%。建议进行设备检查和维护。",
            'action' => '查看健康分析',
            'action_type' => 'health_analysis',
            'device_id' => $device->id,
        ];
    }

    private function generateTemperatureSuggestion(Device $device): array
    {
        return [
            'title' => '温度过高警告',
            'description' => "{$device->name} 当前温度 {$device->temperature}°C，超过正常范围。建议检查散热系统。",
            'action' => '查看设备详情',
            'action_type' => 'view',
        ];
    }

    private function generateRackCapacitySuggestion(Device $device): array
    {
        if (! $device instanceof Rack) {
            $device = $device->rack;
        }

        if (! $device) {
            return [
                'title' => '机柜容量预警',
                'description' => '机柜容量接近上限，请考虑扩展或重新分配设备。',
                'action' => '查看机柜详情',
                'action_type' => 'view',
            ];
        }

        $availableRacks = Rack::with('room')
            ->where('id', '!=', $device->id)
            ->get()
            ->filter(fn ($r) => ($r->slots ?? 42) - $r->devices()->count() > 5)
            ->sortBy(fn ($r) => $r->devices()->count() / ($r->slots ?? 42));

        $bestRack = $availableRacks->first();

        if ($bestRack) {
            return [
                'title' => '机柜容量优化建议',
                'description' => "{$device->name} 容量已超过80%。建议将部分设备迁移到 {$bestRack->name}。",
                'action' => '查看可用机柜',
                'action_type' => 'migrate',
                'target_rack_id' => $bestRack->id,
            ];
        }

        return [
            'title' => '机柜容量预警',
            'description' => "{$device->name} 容量已超过80%，请考虑扩展机柜或清理闲置设备。",
            'action' => '查看机柜详情',
            'action_type' => 'view',
        ];
    }

    private function generateDeviceOfflineSuggestion(Device $device): array
    {
        return [
            'title' => '设备离线告警',
            'description' => "{$device->name} ({$device->ip_address}) 已离线。请检查网络连接、设备电源或物理设备状态。",
            'action' => '查看设备详情',
            'action_type' => 'view',
        ];
    }

    public function getSuggestionsForDevice(int $deviceId): array
    {
        $device = Device::with(['rack.room', 'deviceLibrary'])->findOrFail($deviceId);
        $suggestions = [];

        $rules = AlertRule::where('is_enabled', true)->get();

        foreach ($rules as $rule) {
            if (in_array($rule->rule_type, ['power_overload', 'health_decline', 'temperature_high', 'device_offline'])) {
                $value = $this->getMetricValue($device, $rule->rule_type);
                if ($rule->evaluate($value)) {
                    $suggestions[] = $this->generateSuggestion($device, $rule, $value);
                }
            }
        }

        return $suggestions;
    }
}
