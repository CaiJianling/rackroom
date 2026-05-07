<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class DeviceType extends Model
{
    protected $table = 'device_types';

    protected $fillable = [
        'name',
        'icon',
        'color',
        'description',
    ];

    public function deviceLibrary(): HasMany
    {
        return $this->hasMany(DeviceLibrary::class);
    }

    public function devices(): HasManyThrough
    {
        return $this->hasManyThrough(Device::class, DeviceLibrary::class);
    }
}
