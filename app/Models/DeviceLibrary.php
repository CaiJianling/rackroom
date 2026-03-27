<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-27 20:48:43
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 22:37:12
 * @FilePath: /rackroom/app/Models/DeviceLibrary.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

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
