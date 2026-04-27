#!/bin/bash

# SSH WebSocket 服务器停止脚本

echo "=========================================="
echo "  SSH WebSocket 服务器停止脚本"
echo "=========================================="
echo ""

PID=$(pgrep -f "ssh:websocket-server")

if [ -n "$PID" ]; then
    echo "🛑 正在停止 WebSocket 服务器 (PID: $PID)..."
    kill -TERM "$PID"
    sleep 2
    
    # 检查是否已停止
    if pgrep -f "ssh:websocket-server" > /dev/null; then
        echo "⚠️  强制终止进程..."
        pkill -9 -f "ssh:websocket-server"
    fi
    
    echo "✅ WebSocket 服务器已停止"
else
    echo "ℹ️  WebSocket 服务器未在运行"
fi

echo ""
