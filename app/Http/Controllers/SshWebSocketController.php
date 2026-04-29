<?php

namespace App\Http\Controllers;

use App\Services\SshWebSocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class SshWebSocketController extends Controller
{
    private SshWebSocketService $sshService;

    public function __construct(SshWebSocketService $sshService)
    {
        $this->sshService = $sshService;
    }

    /**
     * 显示 WebSocket SSH 终端页面
     */
    public function index()
    {
        $devices = \App\Models\Device::with(['rack.room', 'deviceLibrary.deviceType'])
            ->where('connection_type', 'ssh')
            ->whereNotNull('ip_address')
            ->get();

        return Inertia::render('Tools/WebSocketSshTerminal', [
            'devices' => $devices,
            'websocketUrl' => env('WEBSOCKET_URL', 'ws://' . request()->getHost() . ':8081'),
        ]);
    }

    /**
     * 建立 SSH 连接
     */
    public function connect(Request $request)
    {
        $request->validate([
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'username' => 'required|string|max:255',
            'password' => 'required|string|max:255',
        ]);

        $sessionId = 'ssh_'.uniqid().'_'.bin2hex(random_bytes(8));

        $result = $this->sshService->connect(
            $sessionId,
            $request->input('host'),
            $request->input('port'),
            $request->input('username'),
            $request->input('password')
        );

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'sessionId' => $sessionId,
                'message' => $result['message'],
                'host' => $result['host'],
                'username' => $result['username'],
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'],
        ], 401);
    }

    /**
     * 发送输入
     */
    public function input(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
            'data' => 'required|string|max:4096',
        ]);

        $result = $this->sshService->input(
            $request->input('sessionId'),
            $request->input('data')
        );

        return response()->json($result);
    }

    /**
     * 执行命令
     */
    public function execute(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
            'command' => 'required|string|max:4096',
        ]);

        $result = $this->sshService->execute(
            $request->input('sessionId'),
            $request->input('command')
        );

        return response()->json($result);
    }

    /**
     * 获取输出（长轮询）
     */
    public function output(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        $sessionId = $request->input('sessionId');

        // 检查连接是否存在
        if (! $this->sshService->isConnected($sessionId)) {
            // 尝试从缓存恢复
            $sessionData = Cache::get('ssh_session_'.$sessionId);
            if (! $sessionData) {
                return response()->json([
                    'success' => false,
                    'expired' => true,
                    'message' => '会话已过期',
                ], 410);
            }

            // 尝试恢复连接
            $this->sshService->connect(
                $sessionId,
                $sessionData['host'],
                $sessionData['port'],
                $sessionData['username'],
                $sessionData['password']
            );
        }

        // 读取输出（非阻塞）
        $output = $this->readOutput($sessionId);

        return response()->json([
            'success' => true,
            'output' => $output,
        ]);
    }

    /**
     * 断开连接
     */
    public function disconnect(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        $this->sshService->disconnect($request->input('sessionId'));

        return response()->json([
            'success' => true,
            'message' => '已断开连接',
        ]);
    }

    /**
     * 读取输出
     */
    protected function readOutput(string $sessionId): string
    {
        // 从缓存获取输出缓冲区
        $buffer = Cache::get('ssh_output_'.$sessionId, '');
        Cache::put('ssh_output_'.$sessionId, '', 60);

        return $buffer;
    }
}
