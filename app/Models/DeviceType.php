<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-27 20:48:33
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 21:11:06
 * @FilePath: /rackroom/app/Models/DeviceType.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeviceType extends Model
{
    protected $table = 'device_types';
    
    protected $fillable = [
        'name',
        'icon',
        'description',
    ];

    public function deviceLibrary(): HasMany
    {
        return $this->hasMany(DeviceLibrary::class);
    }
}