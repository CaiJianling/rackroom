<?php

namespace App\Services;

use App\Events\SshOutputEvent;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use phpseclib3\Net\SSH2;
use React\EventLoop\Loop;

/**
 * WebSocket SSH 连接管理器 - Reverb 版本
 *
 * 管理多个并发的 SSH WebSocket 连接
 */
class SshWebSocketService
{
    /**
     * SSH 连接映射 [sessionId => SSH2]
     */
    protected static array $connections = [];

    /**
     * 连接超时时间（秒）
     */
    private const CONNECTION_TIMEOUT = 30;

    /**
     * 创建 SSH 连接
     */
    public function connect(string $sessionId, string $host, int $port, string $username, string $password): array
    {
        try {
            // 关闭已有连接
            $this->disconnect($sessionId);

            // 创建新的 SSH 连接
            $ssh = new SSH2($host, $port, self::CONNECTION_TIMEOUT);

            if (! $ssh->login($username, $password)) {
                return [
                    'success' => false,
                    'message' => '认证失败：用户名或密码错误',
                ];
            }

            // 配置终端
            $ssh->enablePTY();
            $ssh->setTimeout(0);

            // 存储连接
            self::$connections[$sessionId] = $ssh;

            // 保存会话信息到缓存
            Cache::put('ssh_session_'.$sessionId, [
                'host' => $host,
                'port' => $port,
                'username' => $username,
                'password' => $password,
                'connected_at' => time(),
            ], 3600);

            // 启动输出读取循环
            $this->startOutputLoop($sessionId);

            Log::info("SSH WebSocket 连接成功 [{$sessionId}]: {$username}@{$host}:{$port}");

            return [
                'success' => true,
                'message' => '连接成功',
                'host' => $host,
                'username' => $username,
            ];
        } catch (\Exception $e) {
            Log::error("SSH WebSocket 连接失败 [{$sessionId}]: ".$e->getMessage());

            return [
                'success' => false,
                'message' => '连接失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 执行命令
     */
    public function execute(string $sessionId, string $command): array
    {
        if (! isset(self::$connections[$sessionId])) {
            // 尝试从缓存恢复连接
            $result = $this->restoreConnection($sessionId);
            if (! $result['success']) {
                return $result;
            }
        }

        $ssh = self::$connections[$sessionId];

        try {
            // 发送命令
            $written = $ssh->write($command."\n");

            if ($written === false) {
                return [
                    'success' => false,
                    'message' => '发送命令失败',
                ];
            }

            return [
                'success' => true,
                'message' => '命令已发送',
            ];
        } catch (\Exception $e) {
            Log::error("SSH WebSocket 执行失败 [{$sessionId}]: ".$e->getMessage());
            $this->disconnect($sessionId);

            return [
                'success' => false,
                'message' => '执行失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 发送原始输入
     */
    public function input(string $sessionId, string $data): array
    {
        if (! isset(self::$connections[$sessionId])) {
            $result = $this->restoreConnection($sessionId);
            if (! $result['success']) {
                return $result;
            }
        }

        $ssh = self::$connections[$sessionId];

        try {
            $ssh->write($data);

            return ['success' => true];
        } catch (\Exception $e) {
            Log::error("SSH WebSocket 输入失败 [{$sessionId}]: ".$e->getMessage());

            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * 从缓存恢复连接
     */
    protected function restoreConnection(string $sessionId): array
    {
        $sessionData = Cache::get('ssh_session_'.$sessionId);

        if (! $sessionData) {
            return [
                'success' => false,
                'message' => '会话不存在或已过期',
            ];
        }

        // 重新连接
        return $this->connect(
            $sessionId,
            $sessionData['host'],
            $sessionData['port'],
            $sessionData['username'],
            $sessionData['password']
        );
    }

    /**
     * 启动输出读取循环
     */
    protected function startOutputLoop(string $sessionId): void
    {
        if (! isset(self::$connections[$sessionId])) {
            return;
        }

        $ssh = self::$connections[$sessionId];

        // 使用 ReactPHP 事件循环（如果可用）
        if (class_exists(Loop::class)) {
            $loop = Loop::get();

            $loop->addPeriodicTimer(0.1, function () use ($sessionId, $ssh) {
                if (! isset(self::$connections[$sessionId])) {
                    return;
                }

                try {
                    $output = $ssh->read(0);

                    if ($output !== false && $output !== '' && $output !== null) {
                        // 广播输出到前端
                        broadcast(new SshOutputEvent($sessionId, $output))->toOthers();
                    }

                    if ($output === null) {
                        $this->disconnect($sessionId);
                        broadcast(new SshOutputEvent($sessionId, 'SSH 连接已断开', 'disconnect'))->toOthers();
                    }
                } catch (\Exception $e) {
                    Log::error("SSH 输出读取失败 [{$sessionId}]: ".$e->getMessage());
                    $this->disconnect($sessionId);
                }
            });
        } else {
            // 回退：使用原生定时器
            $this->startNativeOutputLoop($sessionId);
        }
    }

    /**
     * 原生 PHP 输出循环
     */
    protected function startNativeOutputLoop(string $sessionId): void
    {
        // 在实际生产环境中应该使用队列或后台进程
        // 这里仅作演示
        Log::info("SSH 使用原生输出循环 [{$sessionId}]");
    }

    /**
     * 断开连接
     */
    public function disconnect(string $sessionId): void
    {
        if (isset(self::$connections[$sessionId])) {
            try {
                self::$connections[$sessionId]->disconnect();
            } catch (\Exception $e) {
                // 忽略
            }
            unset(self::$connections[$sessionId]);
        }

        Cache::forget('ssh_session_'.$sessionId);

        Log::info("SSH WebSocket 断开连接 [{$sessionId}]");
    }

    /**
     * 检查连接是否有效
     */
    public function isConnected(string $sessionId): bool
    {
        return isset(self::$connections[$sessionId]);
    }

    /**
     * 获取连接统计
     */
    public function getStats(): array
    {
        return [
            'active_connections' => count(self::$connections),
            'connections' => array_keys(self::$connections),
        ];
    }
}
