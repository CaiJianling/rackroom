<?php

namespace App\Http\Controllers;

use App\Models\AlertRule;
use App\Services\SmartAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmartAlertController extends Controller
{
    public function __construct(
        private SmartAlertService $smartAlertService
    ) {}

    public function index(): JsonResponse
    {
        $rules = AlertRule::orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $rules,
        ]);
    }

    public function evaluate(): JsonResponse
    {
        $results = $this->smartAlertService->evaluateAllRules();

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }

    public function suggestions(Request $request): JsonResponse
    {
        $deviceId = $request->input('device_id');

        if ($deviceId) {
            $suggestions = $this->smartAlertService->getSuggestionsForDevice((int) $deviceId);
        } else {
            $results = $this->smartAlertService->evaluateAllRules();
            $suggestions = array_column($results['triggered'], 'suggestion');
        }

        return response()->json([
            'success' => true,
            'data' => $suggestions,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'rule_type' => 'required|in:' . implode(',', array_keys(AlertRule::RULE_TYPES)),
            'condition' => 'required|in:' . implode(',', array_keys(AlertRule::CONDITIONS)),
            'condition_value' => 'required|numeric',
            'severity' => 'required|in:' . implode(',', array_keys(AlertRule::SEVERITIES)),
            'is_enabled' => 'boolean',
            'suggestion' => 'nullable|string|max:1000',
        ]);

        $rule = AlertRule::create($validated);

        return response()->json([
            'success' => true,
            'message' => '告警规则创建成功',
            'data' => $rule,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rule = AlertRule::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'rule_type' => 'sometimes|required|in:' . implode(',', array_keys(AlertRule::RULE_TYPES)),
            'condition' => 'sometimes|required|in:' . implode(',', array_keys(AlertRule::CONDITIONS)),
            'condition_value' => 'sometimes|required|numeric',
            'severity' => 'sometimes|required|in:' . implode(',', array_keys(AlertRule::SEVERITIES)),
            'is_enabled' => 'boolean',
            'suggestion' => 'nullable|string|max:1000',
        ]);

        $rule->update($validated);

        return response()->json([
            'success' => true,
            'message' => '告警规则更新成功',
            'data' => $rule,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $rule = AlertRule::findOrFail($id);
        $rule->delete();

        return response()->json([
            'success' => true,
            'message' => '告警规则删除成功',
        ]);
    }

    public function toggle(int $id): JsonResponse
    {
        $rule = AlertRule::findOrFail($id);
        $rule->update(['is_enabled' => !$rule->is_enabled]);

        return response()->json([
            'success' => true,
            'message' => $rule->is_enabled ? '告警规则已启用' : '告警规则已禁用',
            'data' => $rule,
        ]);
    }
}
