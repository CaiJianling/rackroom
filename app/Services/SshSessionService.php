<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use phpseclib3\Net\SSH2;

/**
 * SSH 会话管理服务 - 无状态版本
 *
 * 每次执行命令时建立连接，执行完成后断开
 * 适合 HTTP 无状态架构
 */
class SshSessionService
{
    /**
     * 连接超时时间（秒）
     */
    private const CONNECTION_TIMEOUT = 30;

    /**
     * 执行 SSH 命令
     *
     * @param  string  $host  主机地址
     * @param  int  $port  SSH端口
     * @param  string  $username  用户名
     * @param  string  $password  密码
     * @param  string  $command  要执行的命令
     * @return array ['success' => bool, 'output' => string, 'message' => string]
     */
    public function execute(string $host, int $port, string $username, string $password, string $command): array
    {
        $ssh = null;

        try {
            // 创建 SSH 连接
            $ssh = new SSH2($host, $port, self::CONNECTION_TIMEOUT);

            // 尝试登录
            if (! $ssh->login($username, $password)) {
                return [
                    'success' => false,
                    'output' => '',
                    'message' => '认证失败：用户名或密码错误',
                ];
            }

            // 设置超时
            $ssh->setTimeout(10);

            // 执行命令并获取输出
            $output = $ssh->exec($command);

            // 断开连接
            $ssh->disconnect();

            return [
                'success' => true,
                'output' => $output !== false ? $this->sanitizeOutput($output) : '',
                'message' => '',
            ];
        } catch (\Exception $e) {
            Log::error("SSH 执行失败 {$host}: ".$e->getMessage());

            // 确保连接关闭
            if ($ssh !== null) {
                try {
                    $ssh->disconnect();
                } catch (\Exception $e) {
                    // 忽略断开错误
                }
            }

            return [
                'success' => false,
                'output' => '',
                'message' => '执行失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 测试连接是否可用
     *
     * @param  string  $host  主机地址
     * @param  int  $port  SSH端口
     * @param  string  $username  用户名
     * @param  string  $password  密码
     * @return array ['success' => bool, 'message' => string]
     */
    public function testConnection(string $host, int $port, string $username, string $password): array
    {
        $ssh = null;

        try {
            $ssh = new SSH2($host, $port, self::CONNECTION_TIMEOUT);

            if (! $ssh->login($username, $password)) {
                return [
                    'success' => false,
                    'message' => '认证失败：用户名或密码错误',
                ];
            }

            // 执行简单命令测试
            $output = $ssh->exec('echo "connected"');
            $ssh->disconnect();

            return [
                'success' => true,
                'message' => '连接成功',
                'output' => $this->sanitizeOutput($output),
            ];
        } catch (\Exception $e) {
            if ($ssh !== null) {
                try {
                    $ssh->disconnect();
                } catch (\Exception $e) {
                    // 忽略
                }
            }

            return [
                'success' => false,
                'message' => '连接失败: '.$e->getMessage(),
            ];
        }
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
}
