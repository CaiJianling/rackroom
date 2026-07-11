<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class H3cPasswordChangeLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'ip_address',
        'port',
        'username',
        'status',
        'message',
        'user_id',
        'executed_at',
    ];

    protected $casts = [
        'executed_at' => 'datetime',
        'port' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
