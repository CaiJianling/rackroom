<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function index(Request $request)
    {
        $query = Room::query()->withCount('racks');

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                ->orWhere('location', 'like', "%{$search}%")
                ->orWhere('manager', 'like', "%{$search}%");
        }

        $rooms = $query->latest()->get();

        return inertia('Room/Index', compact('rooms'));
    }

    public function create()
    {
        return inertia('Room/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'manager' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        Room::create($validated);

        return redirect()->route('rooms.index')->with('success', __('validation.created'));
    }

    public function show(Room $room)
    {
        return inertia('Room/Show', compact('room'));
    }

    public function edit(Room $room)
    {
        return inertia('Room/Edit', compact('room'));
    }

    public function update(Request $request, Room $room)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'manager' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $room->update($validated);

        return redirect()->route('rooms.index')->with('success', __('validation.updated'));
    }

    public function destroy(Room $room)
    {
        // 检查是否关联有机柜
        if ($room->racks()->exists()) {
            return redirect()->route('rooms.index')
                ->with('error', __('validation.room_has_racks'));
        }

        $room->delete();

        return redirect()->route('rooms.index')->with('success', __('validation.deleted'));
    }
}
