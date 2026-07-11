<?php

namespace App\Http\Controllers;

use App\Models\DeviceLibrary;
use App\Models\DeviceType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceLibraryController extends Controller
{
    public function index()
    {
        $deviceLibrary = DeviceLibrary::with(['deviceType', 'devices.rack'])->orderBy('created_at', 'desc')->get();
        $deviceTypes = DeviceType::all();

        return Inertia::render('DeviceLibrary/Index', [
            'deviceLibrary' => $deviceLibrary,
            'deviceTypes' => $deviceTypes,
            'breadcrumbs' => [
                ['title' => __('navigation.deviceManagement'), 'href' => '#'],
                ['title' => __('navigation.deviceLibrary'), 'href' => '/device-library'],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'device_type_id' => 'required|exists:device_types,id',
            'name' => 'required|string|max:255',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'u_height' => 'required|integer|min:1',
            'power' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
        ]);

        DeviceLibrary::create($validated);

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.created'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.created'));
        }

        return redirect()->route('device-library.index')->with('success', __('validation.created'));
    }

    public function update(Request $request, DeviceLibrary $deviceLibrary)
    {
        $validated = $request->validate([
            'device_type_id' => 'required|exists:device_types,id',
            'name' => 'required|string|max:255',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'serial_number' => 'nullable|string|max:255',
            'u_height' => 'required|integer|min:1',
            'power' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $deviceLibrary->update($validated);

        $syncFields = [];
        if (array_key_exists('power', $validated)) {
            $syncFields['power'] = $validated['power'];
        }
        if (array_key_exists('model', $validated)) {
            $syncFields['model'] = $validated['model'];
        }
        if (array_key_exists('manufacturer', $validated)) {
            $syncFields['manufacturer'] = $validated['manufacturer'];
        }
        if (array_key_exists('serial_number', $validated)) {
            $syncFields['serial_number'] = $validated['serial_number'];
        }

        if (! empty($syncFields)) {
            $deviceLibrary->devices()->update($syncFields);
        }

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.updated'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.updated'));
        }

        return redirect()->route('device-library.index')->with('success', __('validation.updated'));
    }

    public function destroy(Request $request, DeviceLibrary $deviceLibrary)
    {
        // 检查设备是否已被使用（有关联的设备实例）
        if ($deviceLibrary->devices()->exists()) {
            if ($request->header('X-Inertia') && $request->wantsJson()) {
                return back()->with('error', __('validation.device_library_in_use'));
            }

            return redirect()->route('device-library.index')
                ->with('error', __('validation.device_library_in_use'));
        }

        $deviceLibrary->delete();

        // 检查请求来源，如果是可视化编辑页面则保持在该页面
        $referer = $request->headers->get('referer');
        if ($referer && str_contains($referer, '/racks/visual-edit')) {
            return back()->with('success', __('validation.deleted'));
        }

        // 如果是 Inertia 请求且接受 JSON 响应（AJAX）
        if ($request->header('X-Inertia') && $request->wantsJson()) {
            return back()->with('success', __('validation.deleted'));
        }

        return redirect()->route('device-library.index')->with('success', __('validation.deleted'));
    }
}
