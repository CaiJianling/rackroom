<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-07-03 20:32:53
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-07-03 20:50:22
 * @FilePath: /rackroom/app/Models/AlertRuleExecution.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertRuleExecution extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_rule_id',
        'device_id',
        'alert_id',
        'trigger_value',
        'triggered_at',
    ];

    protected $casts = [
        'triggered_at' => 'datetime',
    ];

    public function alertRule(): BelongsTo
    {
        return $this->belongsTo(AlertRule::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(Alert::class);
    }
}
