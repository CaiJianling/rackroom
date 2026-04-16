<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRegistrationEnabled
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 检查是否是第一个用户，第一个用户总是可以注册
        $isFirstUser = User::count() === 0;
        $registrationEnabled = SystemSetting::get('registration_enabled', true);

        // 如果不是第一个用户且注册已关闭，则拒绝访问
        if (! $isFirstUser && ! $registrationEnabled) {
            // 对于 API/JSON 请求返回 JSON 响应
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => __('auth.registration_disabled'),
                ], 403);
            }

            // 对于 Web 请求重定向到登录页面
            return redirect()->route('login')->with('error', __('auth.registration_disabled'));
        }

        return $next($request);
    }
}
