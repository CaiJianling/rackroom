<?php

namespace App\Http\Controllers;

use App\Models\RackType;
use Illuminate\Http\Request;

class RackTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = RackType::query();

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $rackTypes = $query->latest()->get();

        return inertia('RackType/Index', compact('rackTypes'));
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

        return redirect()->route('rack-types.index');
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

        $rackType->update($validated);

        return redirect()->route('rack-types.index');
    }

    public function destroy(RackType $rackType)
    {
        $rackType->delete();
        return redirect()->route('rack-types.index');
    }
}