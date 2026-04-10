<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use App\Models\Rack;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DeviceController extends Controller
{
    public function index(Request $request)
    {
        $query = Device::with(['rack', 'deviceLibrary', 'deviceLibrary.deviceType']);

        $search = $request->input('search');
        if ($search) {
            $query->where('name', 'like', "%{$search}%")
                ->orWhere('model', 'like', "%{$search}%")
                ->orWhere('manufacturer', 'like', "%{$search}%")
                ->orWhere('serial_number', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%");
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
        $deviceLibrary = DeviceLibrary::with('deviceType')->get();
        $deviceTypes = DeviceType::all();

        return inertia('Device/Index', compact('devices', 'racks', 'deviceLibrary', 'deviceTypes'));
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
            'device_library_id' => 'nullable|exists:device_library,id',
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|in:server,network,storage,other',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'u_position' => 'nullable|integer|min:1|max:100',
            'connection_type' => 'nullable|string|max:255',
            'connection_port' => 'nullable|integer|min:0|max:65535',
            'ip_address' => 'nullable|string|max:255',
            'status' => 'required|string|in:online,offline,maintenance',
            'description' => 'nullable|string',
        ]);

        // U位范围占用校验（考虑设备高度）
        if (! empty($validated['rack_id']) && ! empty($validated['u_position'])) {
            $conflict = $this->checkUPositionConflict(
                $validated['rack_id'],
                $validated['u_position'],
                $validated['device_library_id'] ?? null
            );

            if ($conflict) {
                return back()->withErrors([
                    'u_position' => $conflict['message'],
                ])->withInput();
            }
        }

        if (! empty($validated['device_library_id'])) {
            $deviceLibrary = DeviceLibrary::with('deviceType')->find($validated['device_library_id']);
            if ($deviceLibrary) {
                $validated['power'] = $deviceLibrary->power;
                $validated['serial_number'] = $deviceLibrary->serial_number;
                $validated['model'] = $deviceLibrary->model;
                $validated['manufacturer'] = $deviceLibrary->manufacturer;
                if ($deviceLibrary->deviceType) {
                    $validated['category'] = $deviceLibrary->deviceType->name;
                }
            }
        } else {
            $validated['power'] = 0;
            $validated['serial_number'] = null;
            $validated['category'] = $validated['category'] ?? 'other';
        }

        Device::create($validated);

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back();
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back();
        }

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
            'device_library_id' => 'nullable|exists:device_library,id',
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|in:server,network,storage,other',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'u_position' => 'nullable|integer|min:1|max:100',
            'connection_type' => 'nullable|string|max:255',
            'connection_port' => 'nullable|integer|min:0|max:65535',
            'ip_address' => 'nullable|string|max:255',
            'status' => 'required|string|in:online,offline,maintenance',
            'description' => 'nullable|string',
        ]);

        // U位范围占用校验（排除自身，考虑设备高度）
        if (! empty($validated['rack_id']) && ! empty($validated['u_position'])) {
            $conflict = $this->checkUPositionConflict(
                $validated['rack_id'],
                $validated['u_position'],
                $validated['device_library_id'] ?? null,
                $device->id
            );

            if ($conflict) {
                return back()->withErrors([
                    'u_position' => $conflict['message'],
                ])->withInput();
            }
        }

        if (! empty($validated['device_library_id'])) {
            $deviceLibrary = DeviceLibrary::with('deviceType')->find($validated['device_library_id']);
            if ($deviceLibrary) {
                $validated['power'] = $deviceLibrary->power;
                $validated['serial_number'] = $deviceLibrary->serial_number;
                $validated['model'] = $deviceLibrary->model;
                $validated['manufacturer'] = $deviceLibrary->manufacturer;
                if ($deviceLibrary->deviceType) {
                    $validated['category'] = $deviceLibrary->deviceType->name;
                }
            }
        } else {
            $validated['power'] = 0;
            $validated['serial_number'] = null;
            $validated['category'] = $validated['category'] ?? 'other';
        }

        $device->update($validated);

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back();
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back();
        }

        return redirect()->route('devices.index');
    }

    public function destroy(Device $device, Request $request)
    {
        $device->delete();

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back();
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back();
        }

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

    /**
     * 检查U位范围冲突（考虑设备高度）
     *
     * @param  int  $rackId  机柜ID
     * @param  int  $uPosition  目标U位
     * @param  int|null  $deviceLibraryId  设备库ID（用于获取U高度）
     * @param  int|null  $excludeDeviceId  排除的设备ID（编辑时使用）
     * @return array|null 返回冲突信息或null
     */
    private function checkUPositionConflict(int $rackId, int $uPosition, ?int $deviceLibraryId, ?int $excludeDeviceId = null): ?array
    {
        // 获取新设备的U高度
        $newDeviceHeight = 1;
        if ($deviceLibraryId) {
            $deviceLibrary = DeviceLibrary::find($deviceLibraryId);
            $newDeviceHeight = $deviceLibrary?->u_height ?? 1;
        }

        // 计算新设备占用的U位范围
        $newStart = $uPosition;
        $newEnd = $uPosition + $newDeviceHeight - 1;

        // 查询该机柜下的所有设备
        $query = Device::with('deviceLibrary')
            ->where('rack_id', $rackId);

        if ($excludeDeviceId) {
            $query->where('id', '!=', $excludeDeviceId);
        }

        $existingDevices = $query->get();

        foreach ($existingDevices as $existingDevice) {
            // 获取现有设备的U高度
            $existingHeight = $existingDevice->deviceLibrary?->u_height ?? 1;
            $existingStart = $existingDevice->u_position;
            $existingEnd = $existingDevice->u_position + $existingHeight - 1;

            // 检查范围是否冲突（两个区间有交集）
            // 新区间: [newStart, newEnd]
            // 现有区间: [existingStart, existingEnd]
            // 冲突条件: newStart <= existingEnd && newEnd >= existingStart
            if ($newStart <= $existingEnd && $newEnd >= $existingStart) {
                return [
                    'conflict' => true,
                    'message' => "U位 {$uPosition}-{$newEnd} 与设备「{$existingDevice->name}」占用的 U{$existingStart}-{$existingEnd} 冲突，请选择其他U位。",
                ];
            }
        }

        return null;
    }
}
