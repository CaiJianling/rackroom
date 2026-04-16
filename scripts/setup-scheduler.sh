#!/bin/bash

# RackRoom 定时任务自动配置脚本
# 支持：Cron / Supervisor / Systemd

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取项目路径
PROJECT_PATH="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_USER=$(whoami)

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  RackRoom 定时任务配置工具${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "项目路径: $PROJECT_PATH"
echo "当前用户: $CURRENT_USER"
echo ""

# 检查 PHP 是否可用
if ! command -v php &> /dev/null; then
    echo -e "${RED}错误: 未找到 PHP 命令${NC}"
    exit 1
fi

# 菜单
show_menu() {
    echo "请选择操作："
    echo ""
    echo "【配置】"
    echo "1) Cron (推荐用于共享主机/简单部署)"
    echo "2) Supervisor (推荐用于生产环境)"
    echo "3) Systemd (推荐用于现代 Linux 发行版)"
    echo "4) 仅手动运行 (开发测试)"
    echo ""
    echo "【管理】"
    echo "5) 检查当前定时任务状态"
    echo "6) 删除/停用定时任务"
    echo ""
    echo "0) 退出"
    echo ""
}

# 配置 Cron
setup_cron() {
    echo -e "${YELLOW}正在配置 Cron...${NC}"
    
    # 检查是否已有任务
    if crontab -l 2>/dev/null | grep -q "schedule:run"; then
        echo -e "${YELLOW}警告: 已存在 Laravel 定时任务${NC}"
        read -p "是否覆盖? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "已取消"
            return
        fi
        # 删除旧任务
        crontab -l 2>/dev/null | grep -v "schedule:run" | crontab -
    fi
    
    # 添加新任务
    (crontab -l 2>/dev/null; echo "* * * * * cd $PROJECT_PATH && php artisan schedule:run >> /dev/null 2>&1") | crontab -
    
    echo -e "${GREEN}✓ Cron 配置成功!${NC}"
    echo ""
    echo "已添加以下任务:"
    crontab -l | grep "schedule:run"
    echo ""
    echo -e "${YELLOW}提示: 可以使用 'crontab -e' 手动编辑${NC}"
}

# 配置 Supervisor
setup_supervisor() {
    echo -e "${YELLOW}正在配置 Supervisor...${NC}"
    
    if ! command -v supervisorctl &> /dev/null; then
        echo -e "${RED}错误: 未安装 Supervisor${NC}"
        echo "请先安装:"
        echo "  Ubuntu/Debian: sudo apt-get install supervisor"
        echo "  CentOS/RHEL: sudo yum install supervisor"
        return
    fi
    
    # 创建配置文件
    CONFIG_FILE="/etc/supervisor/conf.d/rackroom-scheduler.conf"
    
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}警告: 配置文件已存在${NC}"
        read -p "是否覆盖? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "已取消"
            return
        fi
    fi
    
    # 需要 sudo
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}错误: 需要 root 权限来配置 Supervisor${NC}"
        echo "请使用 sudo 运行此脚本"
        return
    fi
    
    cat > "$CONFIG_FILE" << EOF
[program:rackroom-scheduler]
process_name=%(program_name)s
command=php $PROJECT_PATH/artisan schedule:work
autostart=true
autorestart=true
user=$CURRENT_USER
redirect_stderr=true
stdout_logfile=$PROJECT_PATH/storage/logs/scheduler.log
stopwaitsecs=3600
EOF
    
    supervisorctl reread
    supervisorctl update
    supervisorctl start rackroom-scheduler
    
    echo -e "${GREEN}✓ Supervisor 配置成功!${NC}"
    echo ""
    echo "配置文件: $CONFIG_FILE"
    echo "日志文件: $PROJECT_PATH/storage/logs/scheduler.log"
    echo ""
    echo "管理命令:"
    echo "  supervisorctl status rackroom-scheduler"
    echo "  supervisorctl stop rackroom-scheduler"
    echo "  supervisorctl start rackroom-scheduler"
    echo "  supervisorctl restart rackroom-scheduler"
}

# 配置 Systemd
setup_systemd() {
    echo -e "${YELLOW}正在配置 Systemd...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/rackroom-scheduler.service"
    
    if [ -f "$SERVICE_FILE" ]; then
        echo -e "${YELLOW}警告: 服务文件已存在${NC}"
        read -p "是否覆盖? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "已取消"
            return
        fi
    fi
    
    # 需要 sudo
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}错误: 需要 root 权限来配置 Systemd${NC}"
        echo "请使用 sudo 运行此脚本"
        return
    fi
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=RackRoom Laravel Scheduler
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_PATH
ExecStart=/usr/bin/php $PROJECT_PATH/artisan schedule:work
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable rackroom-scheduler
    systemctl start rackroom-scheduler
    
    echo -e "${GREEN}✓ Systemd 配置成功!${NC}"
    echo ""
    echo "服务文件: $SERVICE_FILE"
    echo ""
    echo "管理命令:"
    echo "  systemctl status rackroom-scheduler"
    echo "  systemctl stop rackroom-scheduler"
    echo "  systemctl start rackroom-scheduler"
    echo "  systemctl restart rackroom-scheduler"
}

# 手动运行
setup_manual() {
    echo -e "${YELLOW}手动运行模式 (仅开发测试)${NC}"
    echo ""
    echo "在项目目录下执行以下命令:"
    echo ""
    echo -e "${GREEN}  cd $PROJECT_PATH${NC}"
    echo -e "${GREEN}  php artisan schedule:work${NC}"
    echo ""
    echo -e "${YELLOW}注意: 此命令需要保持运行，关闭终端后定时任务将停止${NC}"
}

# 检查状态
check_status() {
    echo -e "${GREEN}定时任务状态检查${NC}"
    echo ""
    
    # 检查 Cron
    echo "1. Cron 任务:"
    if crontab -l 2>/dev/null | grep -q "schedule:run"; then
        echo -e "   ${GREEN}✓ 已配置${NC}"
        crontab -l | grep "schedule:run" | sed 's/^/   /'
    else
        echo -e "   ${RED}✗ 未配置${NC}"
    fi
    echo ""
    
    # 检查 Supervisor
    echo "2. Supervisor:"
    if command -v supervisorctl &> /dev/null; then
        if supervisorctl status rackroom-scheduler 2>/dev/null | grep -q "RUNNING\|STARTING\|STOPPED\|FATAL"; then
            echo -e "   ${GREEN}✓ 已配置${NC}"
            supervisorctl status rackroom-scheduler 2>/dev/null | sed 's/^/   /'
        else
            echo -e "   ${RED}✗ 未配置${NC}"
        fi
    else
        echo -e "   ${YELLOW}- Supervisor 未安装${NC}"
    fi
    echo ""
    
    # 检查 Systemd
    echo "3. Systemd 服务:"
    if systemctl list-unit-files | grep -q "rackroom-scheduler"; then
        if systemctl is-active rackroom-scheduler &>/dev/null; then
            echo -e "   ${GREEN}✓ 运行中${NC}"
        else
            echo -e "   ${YELLOW}○ 已停止${NC}"
        fi
        systemctl status rackroom-scheduler --no-pager 2>/dev/null | head -3 | sed 's/^/   /'
    else
        echo -e "   ${RED}✗ 未配置${NC}"
    fi
    echo ""
    
    # 检查最后检测时间
    echo "4. 自动检测状态:"
    cd "$PROJECT_PATH"
    php artisan tinker --execute="
        \$log = \App\Models\DetectionLog::where('type', 'auto')->orderByDesc('created_at')->first();
        if (\$log) {
            echo '   上次检测: ' . \$log->created_at->diffForHumans() . PHP_EOL;
            echo '   状态: ' . \$log->status . PHP_EOL;
        } else {
            echo '   尚无检测记录' . PHP_EOL;
        }
    " 2>/dev/null || echo -e "   ${YELLOW}无法获取状态${NC}"
}

# 删除配置
remove_config() {
    echo -e "${YELLOW}删除定时任务配置${NC}"
    echo ""
    
    # 删除 Cron
    if crontab -l 2>/dev/null | grep -q "schedule:run"; then
        echo -e "发现 Cron 任务，正在删除..."
        crontab -l 2>/dev/null | grep -v "schedule:run" | crontab -
        echo -e "${GREEN}✓ Cron 任务已删除${NC}"
    fi
    
    # 删除 Supervisor
    if [ -f "/etc/supervisor/conf.d/rackroom-scheduler.conf" ]; then
        echo -e "发现 Supervisor 配置，正在删除..."
        if [ "$EUID" -eq 0 ]; then
            supervisorctl stop rackroom-scheduler 2>/dev/null || true
            rm -f /etc/supervisor/conf.d/rackroom-scheduler.conf
            supervisorctl reread
            supervisorctl update
            echo -e "${GREEN}✓ Supervisor 配置已删除${NC}"
        else
            echo -e "${YELLOW}需要 root 权限删除 Supervisor 配置，请运行: sudo rm /etc/supervisor/conf.d/rackroom-scheduler.conf${NC}"
        fi
    fi
    
    # 删除 Systemd
    if [ -f "/etc/systemd/system/rackroom-scheduler.service" ]; then
        echo -e "发现 Systemd 服务，正在删除..."
        if [ "$EUID" -eq 0 ]; then
            systemctl stop rackroom-scheduler 2>/dev/null || true
            systemctl disable rackroom-scheduler 2>/dev/null || true
            rm -f /etc/systemd/system/rackroom-scheduler.service
            systemctl daemon-reload
            echo -e "${GREEN}✓ Systemd 服务已删除${NC}"
        else
            echo -e "${YELLOW}需要 root 权限删除 Systemd 服务，请运行: sudo rm /etc/systemd/system/rackroom-scheduler.service${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}定时任务配置已清理完成${NC}"
}

# 主程序
main() {
    while true; do
        show_menu
        read -p "请输入选项 [0-5]: " choice
        echo ""
        
        case $choice in
            1)
                setup_cron
                ;;
            2)
                setup_supervisor
                ;;
            3)
                setup_systemd
                ;;
            4)
                setup_manual
                ;;
            5)
                check_status
                ;;
            6)
                remove_config
                ;;
            0)
                echo "退出"
                exit 0
                ;;
            *)
                echo -e "${RED}无效选项${NC}"
                ;;
        esac
        
        echo ""
        read -p "按回车键继续..."
        echo ""
    done
}

main
