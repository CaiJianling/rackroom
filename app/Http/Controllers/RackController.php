<?php

namespace App\Http\Controllers;

use App\Models\Rack;
use App\Models\Room;
use App\Models\Device;
use Illuminate\Http\Request;

class RackController extends Controller
{
    public function index(Request $request)
    {
        $query = Rack::with('room');

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

        return inertia('Rack/Index', compact('racks', 'rooms'));
    }

    public function visualEdit(Request $request)
    {
        $rooms = Room::all();

        $roomId = $request->input('room_id');
        $query = Rack::with(['room', 'devices']);

        if ($roomId) {
            $query->where('room_id', $roomId);
        }

        $racks = $query->orderBy('room_id')->orderBy('name')->get();
        $devices = Device::whereNull('rack_id')->orWhere('rack_id', 0)->get();

        return inertia('Rack/VisualEdit', compact('racks', 'rooms', 'devices'));
    }

    public function create()
    {
        $rooms = Room::all();
        return inertia('Rack/Create', compact('rooms'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'name' => 'required|string|max:255',
            'u_count' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

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
        return inertia('Rack/Edit', compact('rack', 'rooms'));
    }

    public function update(Request $request, Rack $rack)
    {
        $validated = $request->validate([
            'room_id' => 'required|exists:rooms,id',
            'name' => 'required|string|max:255',
            'u_count' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'device_count' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $rack->update($validated);

        return redirect()->route('racks.index');
    }

    public function destroy(Rack $rack)
    {
        $rack->delete();
        return redirect()->route('racks.index');
    }
}
