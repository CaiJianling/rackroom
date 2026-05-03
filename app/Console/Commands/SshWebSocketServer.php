<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Lang;

/**
 * SSH WebSocket 服务器
 * 基于 PHP 原生 socket 实现
 */
class SshWebSocketServer extends Command
{
    protected $signature = 'ssh:websocket-server
                            {--host= : 服务器绑定地址 (默认从 WEBSOCKET_HOST 环境变量读取)}
                            {--port= : WebSocket 服务器端口 (默认从 WEBSOCKET_PORT 环境变量读取, 默认8081)}';

                            
    protected $description = '启动 SSH WebSocket 服务器';

    private array $clients = [];

    private array $socketMap = [];

    private array $sshConnections = [];

    private $masterSocket;

    public function handle(): int
    {
        $host = $this->option('host') ?: env('WEBSOCKET_HOST', '0.0.0.0');
        $port = (int) ($this->option('port') ?: env('WEBSOCKET_PORT', 8081));

        $this->info('启动 SSH WebSocket 服务器...');
        $this->info("地址: ws://{$host}:{$port}");

        // 创建 socket
        $this->masterSocket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        socket_set_option($this->masterSocket, SOL_SOCKET, SO_REUSEADDR, 1);
        socket_bind($this->masterSocket, $host, $port);
        socket_listen($this->masterSocket);

        $this->info('服务器已启动，等待连接...');

        while (true) {
            $read = [$this->masterSocket];
            foreach ($this->socketMap as $socket) {
                $read[] = $socket;
            }

            $write = null;
            $except = null;

            if (socket_select($read, $write, $except, 0, 100000) === false) {
                continue;
            }

            // 新连接
            if (in_array($this->masterSocket, $read)) {
                $newSocket = socket_accept($this->masterSocket);
                $socketId = spl_object_id($newSocket);

                $this->socketMap[$socketId] = $newSocket;
                $this->clients[$socketId] = [
                    'id' => uniqid(),
                    'handshaked' => false,
                    'ssh' => null,
                ];

                $this->info("新客户端连接: {$this->clients[$socketId]['id']}");

                $key = array_search($this->masterSocket, $read);
                unset($read[$key]);
            }

            // 处理客户端消息
            foreach ($read as $socket) {
                $socketId = spl_object_id($socket);
                $this->handleClientMessage($socketId);
            }

            // 读取 SSH 输出
            $this->readSshOutputs();
        }

        return 0;
    }

    private function handleClientMessage(int $socketId): void
    {
        if (!isset($this->socketMap[$socketId])) {
            return;
        }

        $socket = $this->socketMap[$socketId];
        $data = @socket_recv($socket, $buffer, 8192, 0);

        if ($data === false || $data === 0) {
            $this->disconnectClient($socketId);
            return;
        }

        $clientId = $this->clients[$socketId]['id'] ?? 'unknown';

        // WebSocket 握手
        if (!$this->clients[$socketId]['handshaked']) {
            $this->performHandshake($socketId, $buffer);
            return;
        }

        // 解码 WebSocket 帧
        $message = $this->decode($buffer);
        if ($message === false || empty($message)) {
            return;
        }

        $this->info("收到消息 [{$clientId}]: " . substr($message, 0, 100));

        try {
            $jsonData = json_decode($message, true);
            if (!is_array($jsonData) || !isset($jsonData['type'])) {
                return;
            }

            switch ($jsonData['type']) {
                case 'auth':
                    $this->handleAuth($socketId, $jsonData);
                    break;
                case 'input':
                    $this->handleInput($socketId, $jsonData);
                    break;
                case 'resize':
                    // 处理终端尺寸调整
                    break;
                case 'ping':
                    $this->send($socketId, json_encode(['type' => 'pong']));
                    break;
                case 'disconnect':
                    $this->handleDisconnect($socketId, $jsonData);
                    break;
            }
        } catch (\Exception $e) {
            $this->error("处理消息失败: " . $e->getMessage());
        }
    }

    private function performHandshake(int $socketId, string $headers): void
    {
        if (!isset($this->socketMap[$socketId])) {
            return;
        }

        if (preg_match("/Sec-WebSocket-Key: (.*)\r\n/", $headers, $matches)) {
            $key = base64_encode(pack('H*', sha1($matches[1] . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')));
            $upgrade = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" .
                "Upgrade: websocket\r\n" .
                "Connection: Upgrade\r\n" .
                "Sec-WebSocket-Accept: {$key}\r\n\r\n";

            socket_write($this->socketMap[$socketId], $upgrade);
            $this->clients[$socketId]['handshaked'] = true;

            $this->send($socketId, json_encode([
                'type' => 'connected',
                'message' => Lang::get('ssh.websocket_connected'),
            ]));

            $this->info("WebSocket 握手成功: {$this->clients[$socketId]['id']}");
        }
    }

    private function handleAuth(int $socketId, array $data): void
    {
        if (!isset($data['host'], $data['port'], $data['username'], $data['password'])) {
            $this->send($socketId, json_encode([
                'type' => 'auth_failed',
                'message' => Lang::get('ssh.missing_params'),
            ]));
            return;
        }

        try {
            $ssh = new \phpseclib3\Net\SSH2($data['host'], $data['port'], 30);

            if (!$ssh->login($data['username'], $data['password'])) {
                $this->send($socketId, json_encode([
                    'type' => 'auth_failed',
                    'message' => Lang::get('ssh.invalid_credentials'),
                ]));
                return;
            }

            $ssh->enablePTY();
            $ssh->setTimeout(0);

            $this->clients[$socketId]['ssh'] = $ssh;
            $this->sshConnections[$socketId] = $ssh;

            // 先发送连接成功消息
            $this->send($socketId, json_encode([
                'type' => 'auth_success',
                'message' => Lang::get('ssh.auth_success', ['host' => $data['host'], 'username' => $data['username']]),
                'host' => $data['host'],
                'username' => $data['username'],
            ]));

            $this->info("SSH 连接成功: {$data['username']}@{$data['host']}");

            // 等待服务器自动发送的初始提示符（不主动发送换行）
            usleep(500000); // 500ms 等待

            // 读取并发送初始输出
            $ssh->setTimeout(0.3);
            $initialOutput = $ssh->read();
            if ($initialOutput) {
                $this->send($socketId, json_encode([
                    'type' => 'output',
                    'data' => $initialOutput,
                ]));
            }
        } catch (\Exception $e) {
            $this->error("SSH 连接失败: " . $e->getMessage());
            $this->send($socketId, json_encode([
                'type' => 'auth_failed',
                'message' => Lang::get('ssh.connection_failed', ['message' => $e->getMessage()]),
            ]));
        }
    }

    private function handleInput(int $socketId, array $data): void
    {
        if (!isset($this->clients[$socketId]['ssh'])) {
            return;
        }

        $ssh = $this->clients[$socketId]['ssh'];
        $input = $data['data'] ?? '';

        try {
            $this->info("写入输入: " . json_encode($input));
            $ssh->write($input);

            // 立即读取回显/输出
            usleep(100000); // 100ms 等待
            $this->readAndSendOutput($socketId);

            // 如果是回车，再多等一会读取命令输出
            if ($input === "\r" || $input === "\n") {
                usleep(300000); // 额外 300ms
                $this->readAndSendOutput($socketId);
            }
        } catch (\Exception $e) {
            $this->error("写入 SSH 失败: " . $e->getMessage());
            $this->disconnectClient($socketId);
        }
    }

    private function readAndSendOutput(int $socketId): void
    {
        if (!isset($this->clients[$socketId]['ssh'])) {
            return;
        }

        $ssh = $this->clients[$socketId]['ssh'];

        try {
            // 尝试多次读取
            $allOutput = '';
            for ($i = 0; $i < 5; $i++) {
                $ssh->setTimeout(0.05);
                $output = $ssh->read();

                if ($output === false || $output === null || $output === '') {
                    break;
                }

                $allOutput .= $output;
            }

            if ($allOutput !== '') {
                $this->info("读取到输出，长度: " . strlen($allOutput));
                $this->send($socketId, json_encode([
                    'type' => 'output',
                    'data' => $allOutput,
                ]));
            }
        } catch (\Exception $e) {
            $this->error("读取输出失败: " . $e->getMessage());
        }
    }

    private function readSshOutputs(): void
    {
        foreach ($this->sshConnections as $socketId => $ssh) {
            try {
                // 非阻塞读取
                $allOutput = '';
                for ($i = 0; $i < 3; $i++) {
                    $ssh->setTimeout(0.01);
                    $output = $ssh->read();

                    if ($output === false || $output === null || $output === '') {
                        break;
                    }

                    $allOutput .= $output;
                }

                if ($allOutput !== '') {
                    $this->send($socketId, json_encode([
                        'type' => 'output',
                        'data' => $allOutput,
                    ]));
                }
            } catch (\Exception $e) {
                // 忽略读取错误
            }
        }
    }

    private function disconnectClient(int $socketId): void
    {
        if (!isset($this->clients[$socketId])) {
            return;
        }

        $clientId = $this->clients[$socketId]['id'];

        if (isset($this->clients[$socketId]['ssh'])) {
            try {
                $this->clients[$socketId]['ssh']->disconnect();
            } catch (\Exception $e) {
                // 忽略
            }
            unset($this->sshConnections[$socketId]);
        }

        unset($this->clients[$socketId]);

        if (isset($this->socketMap[$socketId])) {
            socket_close($this->socketMap[$socketId]);
            unset($this->socketMap[$socketId]);
        }

        $this->info("客户端断开: {$clientId}");
    }

    private function handleDisconnect(int $socketId, array $data): void
    {
        $sessionId = $data['sessionId'] ?? '';

        // 先发送断开消息，再断开 SSH 连接（避免 SSH 断开产生的输出干扰）
        $this->send($socketId, json_encode([
            'type' => 'disconnect',
            'sessionId' => $sessionId,
            'message' => Lang::get('ssh.disconnected'),
        ]));

        if (isset($this->sshConnections[$socketId])) {
            try {
                $this->sshConnections[$socketId]->disconnect();
            } catch (\Exception $e) {
                // 忽略
            }
            unset($this->sshConnections[$socketId]);
        }

        $this->disconnectClient($socketId);

        $this->info("客户端主动断开连接: {$sessionId}");
    }

    private function send(int $socketId, string $message): void
    {
        if (!isset($this->socketMap[$socketId])) {
            return;
        }

        $frame = $this->encode($message);
        @socket_write($this->socketMap[$socketId], $frame);
    }

    private function decode(string $data): string|false
    {
        if (strlen($data) < 2) {
            return false;
        }

        $byte = ord($data[0]);
        $opcode = $byte & 0x0F;

        // 关闭帧
        if ($opcode === 8) {
            return false;
        }

        $byte = ord($data[1]);
        $masked = ($byte & 0x80) !== 0;
        $length = $byte & 0x7F;

        $offset = 2;

        if ($length === 126) {
            if (strlen($data) < 4) {
                return false;
            }
            $length = unpack('n', substr($data, 2, 2))[1];
            $offset = 4;
        } elseif ($length === 127) {
            if (strlen($data) < 10) {
                return false;
            }
            $length = unpack('J', substr($data, 2, 8))[1];
            $offset = 10;
        }

        $mask = '';
        if ($masked) {
            if (strlen($data) < $offset + 4) {
                return false;
            }
            $mask = substr($data, $offset, 4);
            $offset += 4;
        }

        if (strlen($data) < $offset + $length) {
            return false;
        }

        $payload = substr($data, $offset, $length);

        if ($masked && $mask !== '') {
            $decoded = '';
            for ($i = 0; $i < $length; $i++) {
                $decoded .= $payload[$i] ^ $mask[$i % 4];
            }
            return $decoded;
        }

        return $payload;
    }

    private function encode(string $message): string
    {
        $length = strlen($message);
        $frame = chr(0x81); // FIN=1, opcode=text

        if ($length <= 125) {
            $frame .= chr($length);
        } elseif ($length <= 65535) {
            $frame .= chr(126) . pack('n', $length);
        } else {
            $frame .= chr(127) . pack('J', $length);
        }

        return $frame . $message;
    }
}
