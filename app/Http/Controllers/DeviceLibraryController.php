<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-27 20:49:30
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 22:38:16
 * @FilePath: /rackroom/app/Http/Controllers/DeviceLibraryController.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

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

        return redirect()->route('device-library.index');
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

        return redirect()->route('device-library.index');
    }

    public function destroy(DeviceLibrary $deviceLibrary)
    {
        $deviceLibrary->delete();
        return redirect()->route('device-library.index');
    }
}
