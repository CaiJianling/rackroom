<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Room extends Model
{
    protected $fillable = [
        'name',
        'location',
        'manager',
        'description',
        'temp_humidity_url',
        'current_temp',
        'current_humidity',
        'temp_humidity_updated_at',
    ];

    public function racks(): HasMany
    {
        return $this->hasMany(Rack::class);
    }

    public function devices(): HasManyThrough
    {
        return $this->hasManyThrough(Device::class, Rack::class);
    }
}
