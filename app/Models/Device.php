<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Device extends Model
{
    protected $fillable = [
        'rack_id',
        'device_library_id',
        'name',
        'category',
        'model',
        'manufacturer',
        'serial_number',
        'u_position',
        'power',
        'connection_type',
        'connection_port',
        'ip_address',
        'status',
        'description',
    ];

    public function rack(): BelongsTo
    {
        return $this->belongsTo(Rack::class);
    }

    public function deviceLibrary(): BelongsTo
    {
        return $this->belongsTo(DeviceLibrary::class);
    }
}
