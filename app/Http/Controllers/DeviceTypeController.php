<?php

namespace App\Http\Controllers;

use App\Models\DeviceType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceTypeController extends Controller
{
    public function index()
    {
        $deviceTypes = DeviceType::withCount('deviceLibrary')->orderBy('created_at', 'desc')->get();

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

        return redirect()->route('device-types.index');
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

        return redirect()->route('device-types.index');
    }

    public function destroy(DeviceType $deviceType)
    {
        $deviceType->delete();

        return redirect()->route('device-types.index');
    }
}
