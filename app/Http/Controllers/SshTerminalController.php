<?php

namespace App\Http\Controllers;

use App\Services\SshSessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class SshTerminalController extends Controller
{
    private SshSessionService $sshService;

    public function __construct(SshSessionService $sshService)
    {
        $this->sshService = $sshService;
    }

    /**
     * 显示 SSH 终端页面
     */
    public function index()
    {
        $devices = \App\Models\Device::with(['rack.room', 'deviceLibrary.deviceType'])
            ->where('connection_type', 'ssh')
            ->whereNotNull('ip_address')
            ->get();

        return Inertia::render('Tools/SshTerminal', [
            'devices' => $devices,
        ]);
    }

    /**
     * 创建 SSH 会话
     */
    public function connect(Request $request)
    {
        $request->validate([
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'username' => 'required|string|max:255',
            'password' => 'required|string|max:255',
            'deviceId' => 'nullable|integer|exists:devices,id',
        ]);

        $host = $request->input('host');
        $port = $request->input('port');
        $username = $request->input('username');
        $password = $request->input('password');

        Log::info("SSH 连接请求: {$username}@{$host}:{$port}");

        $result = $this->sshService->createSession($host, $port, $username, $password);

        if ($result['success']) {
            Log::info("SSH 连接成功: {$username}@{$host}:{$port}, 会话ID: {$result['sessionId']}");

            return response()->json([
                'success' => true,
                'sessionId' => $result['sessionId'],
                'message' => $result['message'],
                'output' => $result['output'] ?? '',
            ]);
        }

        Log::warning("SSH 连接失败: {$username}@{$host}:{$port}, 原因: {$result['message']}");

        return response()->json([
            'success' => false,
            'message' => $result['message'],
        ], 401);
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

        $sessionId = $request->input('sessionId');
        $command = $request->input('command');

        Log::debug("SSH 执行命令 [{$sessionId}]: {$command}");

        $result = $this->sshService->executeCommand($sessionId, $command);

        if (isset($result['closed']) && $result['closed']) {
            return response()->json([
                'success' => true,
                'output' => $result['output'],
                'closed' => true,
                'message' => $result['message'],
            ]);
        }

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'output' => $result['output'],
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'],
        ], 400);
    }

    /**
     * 获取输出（轮询）
     */
    public function getOutput(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        $sessionId = $request->input('sessionId');

        if (! $this->sshService->isSessionValid($sessionId)) {
            return response()->json([
                'success' => false,
                'expired' => true,
                'message' => '会话已失效或已关闭',
            ], 410);
        }

        $output = $this->sshService->readOutput($sessionId);

        return response()->json([
            'success' => true,
            'output' => $output,
        ]);
    }

    /**
     * 关闭会话
     */
    public function disconnect(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        $sessionId = $request->input('sessionId');

        Log::info("SSH 断开连接请求: {$sessionId}");

        $this->sshService->closeSession($sessionId);

        return response()->json([
            'success' => true,
            'message' => '会话已关闭',
        ]);
    }

    /**
     * 获取会话信息
     */
    public function sessionInfo(Request $request)
    {
        $request->validate([
            'sessionId' => 'required|string',
        ]);

        $sessionId = $request->input('sessionId');
        $info = $this->sshService->getSessionInfo($sessionId);

        if ($info === null) {
            return response()->json([
                'success' => false,
                'message' => '会话不存在或已过期',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'info' => $info,
        ]);
    }
}
