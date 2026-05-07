<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeviceLibrary extends Model
{
    protected $table = 'device_library';

    protected $fillable = [
        'device_type_id',
        'name',
        'model',
        'manufacturer',
        'serial_number',
        'u_height',
        'power',
        'description',
    ];

    public function deviceType(): BelongsTo
    {
        return $this->belongsTo(DeviceType::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }
}
