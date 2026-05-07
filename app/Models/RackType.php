<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RackType extends Model
{
    protected $fillable = [
        'name',
        'u_count',
        'power',
        'description',
    ];

    public function racks(): HasMany
    {
        return $this->hasMany(Rack::class);
    }
}