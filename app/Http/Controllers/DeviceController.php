<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\Rack;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DeviceController extends Controller
{
    public function index(Request $request)
    {
        $query = Device::with('rack');

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%")
                  ->orWhere('manufacturer', 'like', "%{$search}%")
                  ->orWhere('serial_number', 'like', "%{$search}%");
        }

        $categoryFilter = $request->input('category');
        if ($categoryFilter && $categoryFilter !== 'all') {
            $query->where('category', $categoryFilter);
        }

        $statusFilter = $request->input('status');
        if ($statusFilter && $statusFilter !== 'all') {
            $query->where('status', $statusFilter);
        }

        $devices = $query->latest()->get();
        $racks = Rack::all();
        
        return inertia('Device/Index', compact('devices', 'racks'));
    }

    public function create()
    {
        $racks = Rack::all();
        return inertia('Device/Create', compact('racks'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rack_id' => 'nullable|exists:racks,id',
            'name' => 'required|string|max:255',
            'category' => 'required|string|in:server,network,storage,other',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'u_position' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'status' => 'required|string|in:online,offline,maintenance',
            'description' => 'nullable|string',
        ]);

        Device::create($validated);

        return redirect()->route('devices.index');
    }

    public function show(Device $device)
    {
        return inertia('Device/Show', compact('device'));
    }

    public function edit(Device $device)
    {
        $racks = Rack::all();
        return inertia('Device/Edit', compact('device', 'racks'));
    }

    public function update(Request $request, Device $device)
    {
        $validated = $request->validate([
            'rack_id' => 'nullable|exists:racks,id',
            'name' => 'required|string|max:255',
            'category' => 'required|string|in:server,network,storage,other',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'u_position' => 'required|integer|min:1|max:100',
            'power' => 'required|integer|min:0',
            'status' => 'required|string|in:online,offline,maintenance',
            'description' => 'nullable|string',
        ]);

        $device->update($validated);

        return redirect()->route('devices.index');
    }

    public function destroy(Device $device)
    {
        $device->delete();
        return redirect()->route('devices.index');
    }

    public function export(): StreamedResponse
    {
        $devices = Device::with('rack')->get();
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="devices.csv"',
        ];

        $callback = function () use ($devices) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['ID', 'Name', 'Category', 'Model', 'Manufacturer', 'Serial Number', 'Rack', 'U Position', 'Power (W)', 'Status', 'Description', 'Created At']);
            
            foreach ($devices as $device) {
                fputcsv($file, [
                    $device->id,
                    $device->name,
                    $device->category,
                    $device->model,
                    $device->manufacturer,
                    $device->serial_number,
                    $device->rack ? $device->rack->name : '-',
                    $device->u_position,
                    $device->power,
                    $device->status,
                    $device->description,
                    $device->created_at,
                ]);
            }
            
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:10240',
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $handle = fopen($path, 'r');
        
        $header = fgetcsv($handle);
        $imported = 0;
        $errors = 0;

        while (($row = fgetcsv($handle)) !== false) {
            try {
                $deviceData = [
                    'name' => $row[0] ?? '',
                    'category' => $row[1] ?? 'server',
                    'model' => $row[2] ?? null,
                    'manufacturer' => $row[3] ?? null,
                    'serial_number' => $row[4] ?? null,
                    'u_position' => $row[5] ?? 1,
                    'power' => $row[6] ?? 0,
                    'status' => $row[7] ?? 'online',
                    'description' => $row[8] ?? null,
                ];

                Device::create($deviceData);
                $imported++;
            } catch (\Exception $e) {
                $errors++;
            }
        }

        fclose($handle);

        return redirect()->route('devices.index')->with('message', "导入完成：成功 {$imported} 条，失败 {$errors} 条");
    }
}