<?php

namespace App\Http\Controllers;

use App\Models\RackType;
use Illuminate\Http\Request;

class RackTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = RackType::withCount('racks');

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $rackTypes = $query->latest()->get();

        return inertia('RackType/Index', [
            'rackTypes' => $rackTypes,
            'breadcrumbs' => [
                ['title' => '机柜管理', 'href' => '#'],
                ['title' => '机柜类型管理', 'href' => '/rack-types'],
            ],
        ]);
    }

    public function create()
    {
        return inertia('RackType/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'u_count' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        RackType::create($validated);

        return redirect()->route('rack-types.index')->with('success', __('validation.created'));
    }

    public function show(RackType $rackType)
    {
        return inertia('RackType/Show', compact('rackType'));
    }

    public function edit(RackType $rackType)
    {
        return inertia('RackType/Edit', compact('rackType'));
    }

    public function update(Request $request, RackType $rackType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'u_count' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        // 检查是否有机柜正在使用该机柜类型
        if ($rackType->racks()->exists()) {
            // 如果正在使用，只允许修改名称、功率、描述，不能修改U数
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'power' => 'required|integer|min:0',
                'description' => 'nullable|string',
            ]);

            // 如果尝试修改U数，返回错误
            if ($request->input('u_count') != $rackType->u_count) {
                return redirect()->route('rack-types.index')
                    ->with('error', __('validation.rack_type_u_count_locked'));
            }
        }

        $rackType->update($validated);

        return redirect()->route('rack-types.index')->with('success', __('validation.updated'));
    }

    public function destroy(RackType $rackType)
    {
        // 检查是否有机柜正在使用该机柜类型
        if ($rackType->racks()->exists()) {
            return redirect()->route('rack-types.index')
                ->with('error', __('validation.rack_type_in_use_delete'));
        }

        $rackType->delete();

        return redirect()->route('rack-types.index')->with('success', __('validation.deleted'));
    }
}
