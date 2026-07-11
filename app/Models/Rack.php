<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rack extends Model
{
    protected $fillable = [
        'room_id',
        'rack_type_id',
        'name',
        'u_count',
        'power',
        'device_count',
        'description',
        'temp_humidity_url',
        'current_temp',
        'current_humidity',
        'temp_humidity_updated_at',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function rackType(): BelongsTo
    {
        return $this->belongsTo(RackType::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }
}
