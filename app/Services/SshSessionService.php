<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use phpseclib3\Net\SSH2;

/**
 * SSH 会话管理服务
 *
 * 管理多个用户的 SSH 会话，支持命令执行和输出获取
 */
class SshSessionService
{
    /**
     * 活跃的 SSH 会话存储
     * 格式: [sessionId => ['ssh' => SSH2, 'host' => string, 'port' => int, 'username' => string, 'lastActivity' => timestamp]]
     */
    private static array $sessions = [];

    /**
     * 会话超时时间（秒）
     */
    private const SESSION_TIMEOUT = 3600; // 1小时

    /**
     * 连接超时时间（秒）
     */
    private const CONNECTION_TIMEOUT = 30;

    /**
     * 创建新的 SSH 会话
     *
     * @param  string  $host  主机地址
     * @param  int  $port  SSH端口
     * @param  string  $username  用户名
     * @param  string  $password  密码
     * @return array ['success' => bool, 'sessionId' => string|null, 'message' => string]
     */
    public function createSession(string $host, int $port, string $username, string $password): array
    {
        try {
            // 清理过期会话
            $this->cleanupExpiredSessions();

            // 创建 SSH 连接
            $ssh = new SSH2($host, $port, self::CONNECTION_TIMEOUT);

            // 尝试登录
            if (! $ssh->login($username, $password)) {
                return [
                    'success' => false,
                    'sessionId' => null,
                    'message' => '认证失败：用户名或密码错误',
                ];
            }

            // 生成唯一会话ID
            $sessionId = $this->generateSessionId();

            // 设置终端模式
            // phpseclib3 中启用 PTY 后，write/read 即可实现交互式 shell
            $ssh->enablePTY();
            $ssh->setTimeout(0); // 设置无限超时，防止空闲断开

            // 存储会话
            self::$sessions[$sessionId] = [
                'ssh' => $ssh,
                'host' => $host,
                'port' => $port,
                'username' => $username,
                'createdAt' => time(),
                'lastActivity' => time(),
                'outputBuffer' => '',
            ];

            // 读取初始输出（欢迎信息等）
            usleep(500000); // 等待500ms让服务器发送欢迎信息
            $initialOutput = $this->readOutput($sessionId);

            return [
                'success' => true,
                'sessionId' => $sessionId,
                'message' => '连接成功',
                'output' => $initialOutput,
            ];
        } catch (\Exception $e) {
            Log::error("SSH 会话创建失败 {$host}: ".$e->getMessage());

            return [
                'success' => false,
                'sessionId' => null,
                'message' => '连接失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 执行命令
     *
     * @param  string  $sessionId  会话ID
     * @param  string  $command  要执行的命令
     * @return array ['success' => bool, 'output' => string, 'message' => string]
     */
    public function executeCommand(string $sessionId, string $command): array
    {
        if (! isset(self::$sessions[$sessionId])) {
            return [
                'success' => false,
                'output' => '',
                'message' => '会话已失效或不存在',
            ];
        }

        try {
            $session = &self::$sessions[$sessionId];
            $ssh = $session['ssh'];

            // 更新最后活动时间
            $session['lastActivity'] = time();

            // 检查连接状态
            if (method_exists($ssh, 'isConnected') && ! $ssh->isConnected()) {
                $this->closeSession($sessionId);

                return [
                    'success' => false,
                    'output' => '',
                    'message' => 'SSH 连接已断开',
                ];
            }

            // 发送命令
            if ($command === 'exit' || $command === 'logout') {
                $ssh->write($command."\n");
                usleep(200000);
                $this->closeSession($sessionId);

                return [
                    'success' => true,
                    'output' => '',
                    'message' => '会话已关闭',
                    'closed' => true,
                ];
            }

            // 发送命令
            $written = $ssh->write($command."\n");
            if ($written === false) {
                Log::error("SSH 写入命令失败 [{$sessionId}]");

                return [
                    'success' => false,
                    'output' => '',
                    'message' => '发送命令失败，连接可能已断开',
                ];
            }

            // 等待命令执行
            usleep(300000); // 等待300ms

            // 读取输出
            $output = $this->readOutput($sessionId);

            return [
                'success' => true,
                'output' => $output,
                'message' => '',
            ];
        } catch (\Exception $e) {
            Log::error("SSH 命令执行失败 [{$sessionId}]: ".$e->getMessage());

            return [
                'success' => false,
                'output' => '',
                'message' => '命令执行失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 读取输出（非阻塞模式）
     *
     * @param  string  $sessionId  会话ID
     * @param  float  $timeout  超时时间（秒）
     */
    public function readOutput(string $sessionId, float $timeout = 0.5): string
    {
        if (! isset(self::$sessions[$sessionId])) {
            return '';
        }

        $session = &self::$sessions[$sessionId];
        $ssh = $session['ssh'];

        $output = '';
        $startTime = microtime(true);

        try {
            while ((microtime(true) - $startTime) < $timeout) {
                $chunk = $ssh->read(0);
                // false 表示没有数据，null 表示连接断开
                if ($chunk === null) {
                    Log::warning("SSH 连接可能在读取时断开 [{$sessionId}]");
                    break;
                }
                if ($chunk !== false && $chunk !== '') {
                    $output .= $chunk;
                }
                usleep(50000); // 50ms
            }
        } catch (\Exception $e) {
            Log::warning("SSH 读取输出异常 [{$sessionId}]: ".$e->getMessage());
        }

        // 清理控制字符
        $output = $this->sanitizeOutput($output);

        $session['lastActivity'] = time();

        return $output;
    }

    /**
     * 关闭 SSH 会话
     *
     * @param  string  $sessionId  会话ID
     */
    public function closeSession(string $sessionId): bool
    {
        if (! isset(self::$sessions[$sessionId])) {
            return false;
        }

        try {
            $session = self::$sessions[$sessionId];
            if (isset($session['ssh'])) {
                $session['ssh']->disconnect();
            }
        } catch (\Exception $e) {
            Log::warning("SSH 会话关闭异常 [{$sessionId}]: ".$e->getMessage());
        }

        unset(self::$sessions[$sessionId]);

        return true;
    }

    /**
     * 检查会话是否有效
     *
     * @param  string  $sessionId  会话ID
     */
    public function isSessionValid(string $sessionId): bool
    {
        if (! isset(self::$sessions[$sessionId])) {
            return false;
        }

        $session = self::$sessions[$sessionId];

        // 检查是否超时
        if ((time() - $session['lastActivity']) > self::SESSION_TIMEOUT) {
            $this->closeSession($sessionId);

            return false;
        }

        // 检查连接是否仍然活跃
        try {
            // 使用 isConnected 方法检查连接状态（如果可用）
            $ssh = $session['ssh'];
            if (method_exists($ssh, 'isConnected') && ! $ssh->isConnected()) {
                $this->closeSession($sessionId);

                return false;
            }

            // 尝试非阻塞读取，但不要仅因为返回 false 就认为连接断开
            // 因为 false 可能只是表示没有数据可读
            $chunk = $ssh->read(0);
            // 只有在明确收到连接断开的信号时才关闭会话
            if ($chunk === null) {
                $this->closeSession($sessionId);

                return false;
            }
        } catch (\Exception $e) {
            Log::warning("SSH 会话检查异常 [{$sessionId}]: ".$e->getMessage());

            // 异常不一定意味着连接断开，继续尝试使用
            return true;
        }

        return true;
    }

    /**
     * 获取会话信息
     *
     * @param  string  $sessionId  会话ID
     */
    public function getSessionInfo(string $sessionId): ?array
    {
        if (! $this->isSessionValid($sessionId)) {
            return null;
        }

        $session = self::$sessions[$sessionId];

        return [
            'host' => $session['host'],
            'port' => $session['port'],
            'username' => $session['username'],
            'createdAt' => $session['createdAt'],
            'lastActivity' => $session['lastActivity'],
        ];
    }

    /**
     * 清理过期会话
     */
    private function cleanupExpiredSessions(): void
    {
        $now = time();
        foreach (self::$sessions as $sessionId => $session) {
            if (($now - $session['lastActivity']) > self::SESSION_TIMEOUT) {
                $this->closeSession($sessionId);
            }
        }
    }

    /**
     * 生成唯一会话ID
     */
    private function generateSessionId(): string
    {
        return 'ssh_'.uniqid().'_'.bin2hex(random_bytes(8));
    }

    /**
     * 清理终端输出中的控制字符
     */
    private function sanitizeOutput(string $output): string
    {
        // 移除 ANSI 转义序列
        $output = preg_replace('/\x1B\[[0-9;]*[a-zA-Z]/', '', $output);

        // 移除其他控制字符（保留换行和制表符）
        $output = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $output);

        // 处理退格键产生的字符
        while (strpos($output, "\x08") !== false) {
            $output = preg_replace('/.\x08/', '', $output);
        }

        return $output;
    }

    /**
     * 获取所有活跃会话数量
     */
    public function getActiveSessionCount(): int
    {
        $this->cleanupExpiredSessions();

        return count(self::$sessions);
    }

    /**
     * 关闭所有会话
     */
    public function closeAllSessions(): void
    {
        foreach (array_keys(self::$sessions) as $sessionId) {
            $this->closeSession($sessionId);
        }
    }
}
