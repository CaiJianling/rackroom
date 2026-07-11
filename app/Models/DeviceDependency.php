<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceDependency extends Model
{
    protected $fillable = [
        'source_device_id',
        'target_device_id',
        'dependency_type',
        'description',
    ];

    public function sourceDevice(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'source_device_id');
    }

    public function targetDevice(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'target_device_id');
    }

    public static function getDependencyTypeOptions(): array
    {
        return [
            ['value' => 'network', 'label' => '网络连接'],
            ['value' => 'power', 'label' => '电源连接'],
            ['value' => 'storage', 'label' => '存储连接'],
            ['value' => 'application', 'label' => '应用依赖'],
            ['value' => 'other', 'label' => '其他'],
        ];
    }
}
