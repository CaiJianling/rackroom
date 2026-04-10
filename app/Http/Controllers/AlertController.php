<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Response;

class AlertController extends Controller
{
    /**
     * 显示告警列表页面
     */
    public function index(Request $request): Response
    {
        $status = $request->input('status', 'all');
        $severity = $request->input('severity', 'all');
        $type = $request->input('type', 'all');
        $search = $request->input('search', '');

        $query = Alert::with(['acknowledgedByUser', 'resolvedByUser']);

        if ($status !== 'all') {
            $query->ofStatus($status);
        }

        if ($severity !== 'all') {
            $query->ofSeverity($severity);
        }

        if ($type !== 'all') {
            $query->where('alert_type', $type);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $alerts = $query->orderByDesc('triggered_at')
            ->paginate(20)
            ->withQueryString();

        // 获取统计信息
        $stats = [
            'total' => Alert::count(),
            'active' => Alert::active()->count(),
            'critical' => Alert::ofSeverity('critical')->active()->count(),
            'warning' => Alert::ofSeverity('warning')->active()->count(),
            'acknowledged' => Alert::ofStatus('acknowledged')->count(),
            'resolved' => Alert::ofStatus('resolved')->count(),
        ];

        // 获取告警类型列表
        $alertTypes = Alert::distinct()->pluck('alert_type');

        return inertia('Alert/Index', [
            'alerts' => $alerts,
            'stats' => $stats,
            'filters' => [
                'status' => $status,
                'severity' => $severity,
                'type' => $type,
                'search' => $search,
            ],
            'alertTypes' => $alertTypes,
            'breadcrumbs' => [
                ['title' => '告警列表', 'href' => '/alerts'],
            ],
        ]);
    }

    /**
     * 获取告警详情
     */
    public function show(Alert $alert): JsonResponse
    {
        $alert->load(['acknowledgedByUser', 'resolvedByUser', 'resource']);

        return response()->json([
            'alert' => $alert,
            'resource' => $this->getResourceDetails($alert),
        ]);
    }

    /**
     * 确认告警
     */
    public function acknowledge(Request $request, Alert $alert): JsonResponse
    {
        if ($alert->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => '只能确认活跃状态的告警',
            ], 422);
        }

        $alert->acknowledge($request->user()->id);

        return response()->json([
            'success' => true,
            'message' => '告警已确认',
            'alert' => $alert->fresh(),
        ]);
    }

    /**
     * 解决告警
     */
    public function resolve(Request $request, Alert $alert): JsonResponse
    {
        $request->validate([
            'note' => 'nullable|string|max:500',
        ]);

        if ($alert->status === 'resolved') {
            return response()->json([
                'success' => false,
                'message' => '告警已解决',
            ], 422);
        }

        $alert->resolve($request->user()->id, $request->input('note'));

        return response()->json([
            'success' => true,
            'message' => '告警已解决',
            'alert' => $alert->fresh(),
        ]);
    }

    /**
     * 批量确认告警
     */
    public function batchAcknowledge(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:alerts,id',
        ]);

        $count = Alert::whereIn('id', $request->input('ids'))
            ->where('status', 'active')
            ->update([
                'status' => 'acknowledged',
                'acknowledged_at' => now(),
                'acknowledged_by' => $request->user()->id,
            ]);

        return response()->json([
            'success' => true,
            'message' => "已确认 {$count} 条告警",
            'count' => $count,
        ]);
    }

    /**
     * 批量解决告警
     */
    public function batchResolve(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:alerts,id',
            'note' => 'nullable|string|max:500',
        ]);

        $count = Alert::whereIn('id', $request->input('ids'))
            ->where('status', '!=', 'resolved')
            ->update([
                'status' => 'resolved',
                'resolved_at' => now(),
                'resolved_by' => $request->user()->id,
                'resolution_note' => $request->input('note'),
            ]);

        return response()->json([
            'success' => true,
            'message' => "已解决 {$count} 条告警",
            'count' => $count,
        ]);
    }

    /**
     * 创建告警（用于系统自动触发）
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'severity' => ['required', Rule::in(['critical', 'warning', 'info'])],
            'alert_type' => 'required|string|max:50',
            'resource_type' => 'required|string|max:50',
            'resource_id' => 'nullable|integer',
            'metadata' => 'nullable|array',
        ]);

        $validated['status'] = 'active';
        $validated['triggered_at'] = now();

        $alert = Alert::create($validated);

        return response()->json([
            'success' => true,
            'alert' => $alert,
        ], 201);
    }

    /**
     * 获取资源详情
     */
    private function getResourceDetails(Alert $alert): ?array
    {
        if (! $alert->resource_id) {
            return null;
        }

        return match ($alert->resource_type) {
            'device' => Device::with('rack.room')->find($alert->resource_id)?->toArray(),
            default => null,
        };
    }
}
