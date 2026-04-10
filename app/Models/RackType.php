<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-27 19:14:17
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 19:14:36
 * @FilePath: /rackroom/app/Models/RackType.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

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