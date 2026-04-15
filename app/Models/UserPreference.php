<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'key',
        'value',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 获取指定键的配置
     */
    public static function getForUser(User $user, string $key, mixed $default = null): mixed
    {
        $preference = self::where('user_id', $user->id)
            ->where('key', $key)
            ->first();

        return $preference ? $preference->value : $default;
    }

    /**
     * 设置指定键的配置
     */
    public static function setForUser(User $user, string $key, mixed $value): void
    {
        self::updateOrCreate(
            ['user_id' => $user->id, 'key' => $key],
            ['value' => $value]
        );
    }
}
