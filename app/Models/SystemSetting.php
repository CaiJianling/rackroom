<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * 获取设置值
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = self::where('key', $key)->first();

        if (! $setting) {
            return $default;
        }

        $value = $setting->value;

        // 根据类型转换值
        return match ($setting->type) {
            'boolean' => (bool) $value,
            'integer' => (int) $value,
            'json' => is_array($value) ? $value : json_decode($value, true),
            default => is_array($value) ? reset($value) : $value,
        };
    }

    /**
     * 设置值
     */
    public static function set(string $key, mixed $value): void
    {
        $setting = self::where('key', $key)->first();

        if ($setting) {
            $setting->update(['value' => json_encode($value)]);
        }
    }
}
