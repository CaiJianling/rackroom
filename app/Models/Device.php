<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 15:25:31
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 20:58:25
 * @FilePath: /rackroom/app/Models/Device.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 15:25:31
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-26 15:27:16
 * @FilePath: /rackroom/app/Models/Device.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

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
