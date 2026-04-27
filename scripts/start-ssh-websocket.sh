#!/bin/bash

# SSH WebSocket 服务器启动脚本

HOST="${1:-0.0.0.0}"
PORT="${2:-8081}"

echo "=========================================="
echo "  SSH WebSocket 服务器启动脚本"
echo "=========================================="
echo ""
echo "服务器地址: ws://${HOST}:${PORT}"
echo ""

# 检查是否已经在运行
PID=$(pgrep -f "ssh:websocket-server")
if [ -n "$PID" ]; then
    echo "⚠️  WebSocket 服务器已在运行 (PID: $PID)"
    echo "   如需重启，请先执行: php artisan ssh:websocket-server:stop"
    echo ""
    exit 1
fi

# 启动服务器
echo "🚀 正在启动 SSH WebSocket 服务器..."
echo "   按 Ctrl+C 停止服务器"
echo ""

cd /www/wwwroot/rackroom.local.host/rackroom
php artisan ssh:websocket-server --host="$HOST" --port="$PORT"
