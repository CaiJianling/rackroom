# SSH WebSocket 终端使用说明

基于 WebSocket 的真正交互式 SSH 终端，支持实时双向通信、终端尺寸调整、多会话管理。

## 功能特性

- ✅ **真正的交互式 SSH** - 全双工通信，支持 vim、top 等交互式程序
- ✅ **终端尺寸自适应** - 支持窗口大小动态调整
- ✅ **多会话管理** - 同时管理多个 SSH 连接
- ✅ **断线检测** - 自动检测连接断开并提示
- ✅ **心跳保活** - 30秒心跳防止连接超时
- ✅ **xterm.js 终端** - 完整的终端仿真体验

## 架构图

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   浏览器     │  ◄──────────────────────►  │  WebSocket  │
│  (xterm.js) │      全双工通信             │   服务器    │
└─────────────┘                            └──────┬──────┘
                                                  │
                                           ┌──────┴──────┐
                                           │  SSH 连接    │
                                           │ (phpseclib) │
                                           └─────────────┘
```

## 安装步骤

### 1. 安装依赖

```bash
composer install
npm install
```

### 2. 配置 WebSocket URL

在 `.env` 文件中添加：

```env
WEBSOCKET_URL=ws://your-server-ip:8081
```

### 3. 启动 WebSocket 服务器

#### 方式一：直接启动（开发环境）

```bash
php artisan ssh:websocket-server

# 或指定地址和端口
php artisan ssh:websocket-server --host=0.0.0.0 --port=8081
```

#### 方式二：使用脚本

```bash
# 启动
./scripts/start-ssh-websocket.sh

# 停止
./scripts/stop-ssh-websocket.sh
```

#### 方式三：使用 Supervisor（生产环境推荐）

创建 `/etc/supervisor/conf.d/ssh-websocket.conf`：

```ini
[program:ssh-websocket]
process_name=%(program_name)s
directory=/www/wwwroot/rackroom.local.host/rackroom
command=php artisan ssh:websocket-server --host=0.0.0.0 --port=8081
autostart=true
autorestart=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/ssh-websocket.log
```

启用配置：

```bash
supervisorctl reread
supervisorctl update
supervisorctl start ssh-websocket
```

### 4. 防火墙配置

确保防火墙开放 WebSocket 端口：

```bash
# UFW
ufw allow 8081/tcp

# firewalld
firewall-cmd --permanent --add-port=8081/tcp
firewall-cmd --reload
```

### 5. Nginx 反向代理（可选）

如需使用域名和 HTTPS：

```nginx
location /ssh-ws {
    proxy_pass http://localhost:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

## 使用方法

1. 访问 **小工具 → SSH WebSocket终端**
2. 双击右侧设备列表中的设备
3. 输入用户名和密码
4. 点击连接
5. 在终端中输入命令

## 支持的命令

由于使用真正的 SSH 连接，支持所有交互式程序：

- ✅ `ls`, `cd`, `pwd` 等基础命令
- ✅ `vim`, `nano` 等编辑器
- ✅ `top`, `htop` 等监控程序
- ✅ `mysql`, `psql` 等数据库客户端
- ✅ 管道和重定向: `ls -la | grep txt`
- ✅ 环境变量和别名

## 消息协议

### 客户端 → 服务器

```json
// 认证
{
  "type": "auth",
  "host": "192.168.1.1",
  "port": 22,
  "username": "root",
  "password": "password"
}

// 终端输入
{
  "type": "input",
  "data": "ls -la\n"
}

// 调整终端尺寸
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}

// 心跳
{
  "type": "ping"
}
```

### 服务器 → 客户端

```json
// 连接成功
{
  "type": "auth_success",
  "message": "认证成功",
  "host": "192.168.1.1",
  "username": "root"
}

// 认证失败
{
  "type": "auth_failed",
  "message": "认证失败：用户名或密码错误"
}

// SSH 输出
{
  "type": "output",
  "data": "total 128\ndrwxr-xr-x 5 root root 4096 Jan 1 00:00 ."
}

// 断开连接
{
  "type": "disconnect",
  "message": "SSH 连接已断开"
}

// 心跳响应
{
  "type": "pong"
}
```

## 故障排除

### WebSocket 连接失败

1. 检查 WebSocket 服务器是否运行：
   ```bash
   pgrep -f "ssh:websocket-server"
   ```

2. 检查防火墙设置

3. 检查浏览器控制台网络日志

### SSH 连接失败

1. 确认目标服务器 SSH 端口可访问
2. 检查用户名和密码
3. 查看服务器日志：
   ```bash
   tail -f storage/logs/laravel.log
   ```

### 终端显示异常

1. 刷新页面重新连接
2. 调整浏览器窗口大小触发重绘
3. 检查 xterm.js 版本兼容性

## 安全建议

⚠️ **生产环境注意事项：**

1. 使用 HTTPS/WSS 加密通信
2. 限制 WebSocket 服务器监听内网地址
3. 设置防火墙规则限制访问来源
4. 启用 SSH 密钥认证替代密码
5. 定期更换 SSH 密钥
6. 监控异常连接行为

## 性能优化

- WebSocket 服务器使用单进程多连接模式
- 每个 SSH 连接独立维护
- 使用 ReactPHP 事件循环实现高并发
- 建议同时连接数不超过 100

## 相关文件

- `app/Services/SshWebSocketService.php` - WebSocket 服务核心
- `app/Console/Commands/SshWebSocketServer.php` - 服务器命令
- `resources/js/pages/Tools/WebSocketSshTerminal.tsx` - 前端组件
- `scripts/start-ssh-websocket.sh` - 启动脚本
- `scripts/stop-ssh-websocket.sh` - 停止脚本
