<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 15:14:08
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 07:14:26
 * @FilePath: /rackroom/app/Models/Rack.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rack extends Model
{
    protected $fillable = [
        'room_id',
        'name',
        'u_count',
        'power',
        'device_count',
        'description',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }
}
