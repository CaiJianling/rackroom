<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 13:44:26
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-26 13:45:25
 * @FilePath: /rackroom/app/Models/Room.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'name',
        'location',
        'rack_count',
        'manager',
        'description',
    ];
}