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

        // 从数据库原始值读取，避免 $casts 自动转换
        $rawValue = $setting->getAttributes()['value'] ?? null;

        if ($rawValue === null) {
            return $default;
        }

        $decoded = json_decode($rawValue, true);

        // 根据类型转换值
        return match ($setting->type) {
            'boolean' => (bool) $decoded,
            'integer' => (int) $decoded,
            'json' => is_array($decoded) ? $decoded : [],
            default => is_array($decoded) ? reset($decoded) : $decoded,
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
