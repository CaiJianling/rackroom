<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 15:14:27
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-30 17:25:40
 * @FilePath: /rackroom/app/Http/Controllers/RackController.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Http\Controllers;

use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use App\Models\RackType;
use App\Models\Room;
use Illuminate\Http\Request;

class RackController extends Controller
{
    public function index(Request $request)
    {
        $query = Rack::with(['room', 'rackType']);

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                ->orWhereHas('room', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                });
        }

        $roomFilter = $request->input('room');
        if ($roomFilter && $roomFilter !== 'all') {
            $query->where('room_id', $roomFilter);
        }

        $racks = $query->latest()->get();
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Index', compact('racks', 'rooms', 'rackTypes'));
    }

    public function visualEdit(Request $request)
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        $roomId = $request->input('room_id');
        $query = Rack::with(['room', 'devices.deviceLibrary']);

        if ($roomId) {
            $query->where('room_id', $roomId);
        }

        $racks = $query->orderBy('room_id')->orderBy('name')->get();
        $deviceLibrary = DeviceLibrary::with('deviceType')->get();
        $deviceTypes = DeviceType::all();

        return inertia('Rack/VisualEdit', [
            'racks' => $racks,
            'rooms' => $rooms,
            'rackTypes' => $rackTypes,
            'deviceLibrary' => $deviceLibrary,
            'deviceTypes' => $deviceTypes,
            'selectedRoom' => $roomId,
        ]);
    }

    public function create()
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Create', compact('rooms', 'rackTypes'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'rack_type_id' => 'nullable|exists:rack_types,id',
            'name' => 'required|string|max:255',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        if ($validated['rack_type_id']) {
            $rackType = RackType::find($validated['rack_type_id']);
            $validated['u_count'] = $rackType->u_count;
            $validated['power'] = $rackType->power;
        } else {
            $validated['u_count'] = 42;
            $validated['power'] = 0;
        }

        Rack::create($validated);

        return redirect()->route('racks.index');
    }

    public function show(Rack $rack)
    {
        return inertia('Rack/Show', compact('rack'));
    }

    public function edit(Rack $rack)
    {
        $rooms = Room::all();
        $rackTypes = RackType::all();

        return inertia('Rack/Edit', compact('rack', 'rooms', 'rackTypes'));
    }

    public function update(Request $request, Rack $rack)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'rack_type_id' => 'nullable|exists:rack_types,id',
            'name' => 'required|string|max:255',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        if ($validated['rack_type_id']) {
            $rackType = RackType::find($validated['rack_type_id']);
            $validated['u_count'] = $rackType->u_count;
            $validated['power'] = $rackType->power;
        } else {
            $validated['u_count'] = 42;
            $validated['power'] = 0;
        }

        $rack->update($validated);

        return redirect()->route('racks.index');
    }

    public function destroy(Rack $rack)
    {
        $rack->delete();

        return redirect()->route('racks.index');
    }
}
