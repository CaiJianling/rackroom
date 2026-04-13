<?php

namespace App\Http\Controllers;

use App\Models\DeviceType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceTypeController extends Controller
{
    public function index()
    {
        $deviceTypes = DeviceType::withCount(['deviceLibrary', 'devices'])->orderBy('created_at', 'desc')->get();

        return Inertia::render('DeviceType/Index', [
            'deviceTypes' => $deviceTypes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        DeviceType::create($validated);

        return redirect()->route('device-types.index')->with('success', __('validation.created'));
    }

    public function update(Request $request, DeviceType $deviceType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $deviceType->update($validated);

        return redirect()->route('device-types.index')->with('success', __('validation.updated'));
    }

    public function destroy(DeviceType $deviceType)
    {
        // 检查是否有设备正在使用此类型（通过 device_library 关联）
        $hasDevices = \App\Models\Device::whereHas('deviceLibrary', function ($query) use ($deviceType) {
            $query->where('device_type_id', $deviceType->id);
        })->exists();

        if ($hasDevices) {
            return redirect()->route('device-types.index')
                ->with('error', __('validation.device_type_in_use'));
        }

        $deviceType->delete();

        return redirect()->route('device-types.index')->with('success', __('validation.deleted'));
    }
}
