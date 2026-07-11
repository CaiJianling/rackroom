<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SystemSettingController extends Controller
{
    /**
     * 显示系统设置页面
     */
    public function index()
    {
        return Inertia::render('Settings/System');
    }

    /**
     * 获取所有系统设置
     */
    public function getAll()
    {
        $settings = SystemSetting::all()->mapWithKeys(function ($setting) {
            return [$setting->key => [
                'value' => self::castValue($setting->value, $setting->type),
                'type' => $setting->type,
                'description' => $setting->description,
            ]];
        });

        return response()->json([
            'success' => true,
            'settings' => $settings,
        ]);
    }

    /**
     * 获取指定设置
     */
    public function get(string $key)
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (! $setting) {
            return response()->json([
                'success' => false,
                'message' => '设置不存在',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'key' => $key,
            'value' => self::castValue($setting->value, $setting->type),
            'type' => $setting->type,
            'description' => $setting->description,
        ]);
    }

    /**
     * 更新设置
     */
    public function update(Request $request, string $key)
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (! $setting) {
            return response()->json([
                'success' => false,
                'message' => '设置不存在',
            ], 404);
        }

        $request->validate([
            'value' => 'required',
        ]);

        $value = $request->input('value');

        // 根据类型验证
        $validatedValue = match ($setting->type) {
            'boolean' => (bool) $value,
            'integer' => (int) $value,
            default => $value,
        };

        // 由于模型有 $casts，直接存储原始值，让模型自动处理编码
        $setting->update(['value' => $validatedValue]);

        return response()->json([
            'success' => true,
            'message' => '设置已更新',
            'value' => $validatedValue,
        ]);
    }

    /**
     * 类型转换
     */
    private static function castValue(mixed $value, string $type): mixed
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return match ($type) {
            'boolean' => (bool) $decoded,
            'integer' => (int) $decoded,
            'json' => is_array($decoded) ? $decoded : json_decode($decoded, true),
            default => is_array($decoded) ? reset($decoded) : $decoded,
        };
    }
}
