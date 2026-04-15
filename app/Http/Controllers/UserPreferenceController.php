<?php

namespace App\Http\Controllers;

use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserPreferenceController extends Controller
{
    /**
     * 获取用户偏好设置
     */
    public function show(string $key)
    {
        $value = UserPreference::getForUser(Auth::user(), $key);

        return response()->json([
            'success' => true,
            'key' => $key,
            'value' => $value,
        ]);
    }

    /**
     * 保存用户偏好设置
     */
    public function store(Request $request, string $key)
    {
        $request->validate([
            'value' => 'required',
        ]);

        UserPreference::setForUser(Auth::user(), $key, $request->input('value'));

        return response()->json([
            'success' => true,
            'message' => '设置已保存',
        ]);
    }

    /**
     * 获取设备状态颜色配置
     */
    public function getDeviceStatusColors()
    {
        $defaultColors = [
            'online' => ['bg' => '#22c55e', 'text' => '#ffffff'],
            'offline' => ['bg' => '#f97316', 'text' => '#ffffff'],
            'maintenance' => ['bg' => '#6b7280', 'text' => '#ffffff'],
        ];

        $colors = UserPreference::getForUser(Auth::user(), 'device_status_colors', $defaultColors);

        return response()->json([
            'success' => true,
            'colors' => $colors,
        ]);
    }

    /**
     * 保存设备状态颜色配置
     */
    public function saveDeviceStatusColors(Request $request)
    {
        $request->validate([
            'colors' => 'required|array',
            'colors.online' => 'required|array',
            'colors.online.bg' => 'required|string',
            'colors.online.text' => 'required|string',
            'colors.offline' => 'required|array',
            'colors.offline.bg' => 'required|string',
            'colors.offline.text' => 'required|string',
            'colors.maintenance' => 'required|array',
            'colors.maintenance.bg' => 'required|string',
            'colors.maintenance.text' => 'required|string',
        ]);

        UserPreference::setForUser(Auth::user(), 'device_status_colors', $request->input('colors'));

        return response()->json([
            'success' => true,
            'message' => '颜色设置已保存',
        ]);
    }
}
