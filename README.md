# RackRoom - 机房设备管理系统

<p align="center">
  <img src="public/favicon.ico" alt="RackRoom Logo" width="80" height="80">
</p>

<p align="center">
  <strong>专业的数据中心机房设备管理解决方案</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-安装部署">安装部署</a> •
  <a href="#-使用说明">使用说明</a> •
  <a href="#-api-接口">API 接口</a> •
  <a href="#-故障排除">故障排除</a> •
  <a href="#-开发规范">开发规范</a>
</p>

---

## 📋 项目简介

RackRoom 是一个现代化的机房设备管理系统，专为数据中心和机房运维团队设计。系统提供从机房、机柜到设备的全方位管理，支持可视化编辑、实时监控、告警管理和报表生成等功能，帮助您高效管理 IT 基础设施。

## ✨ 功能特性

### 🏢 机房管理
- 多机房统一管理
- 机房位置、负责人、描述信息维护
- 机房容量统计与可视化展示

### 🗄️ 机柜管理
- 机柜类型定义（U数、功率）
- 机柜可视化编辑
- U位占用状态实时查看
- 机柜功率监控

### 💻 设备管理
- 设备类型分类（服务器、网络设备、存储等）
- 设备库管理（型号、制造商、U高度）
- IP地址与连接信息管理
- 设备状态监控（在线/离线/维护中）

### 🎨 可视化编辑
- 拖拽式设备管理
- 机柜U位可视化展示
- 设备快速上架下架
- 批量操作支持

### 📊 监控告警
- 实时设备状态监控
- 自动Ping检测
- 告警分级（严重/警告/信息）
- 告警确认与解决流程

### 📈 报表生成
- 资产清单报表
- 设备状态报表
- 机房使用率报表
- 支持 CSV/Excel/JSON 导出
- 报表模板保存与复用

### 🔐 系统功能
- 用户管理与权限控制
- 双因素认证（2FA）
- 数据备份与恢复
- 数据导入导出
- 国际化支持（中/英文）
- 自动检测设备在线状态
- 定时任务调度

## 🔌 API 接口

系统提供 RESTful API 接口，主要端点包括：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/detection-logs` | GET | 获取检测日志 |
| `/api/detection-logs/stats` | GET | 获取检测统计 |
| `/api/detection-logs/detect` | POST | 执行手动检测 |
| `/api/system-settings` | GET | 获取系统设置 |
| `/api/monitor/stats` | GET | 获取监控统计 |
| `/api/monitor/devices` | GET | 获取设备列表 |

详细 API 文档请参考源码中的路由定义：`routes/api.php`

## 🛠️ 技术栈

### 后端
- **Laravel 12** - PHP Web 框架
- **Laravel Fortify** - 认证系统
- **Laravel Inertia** - 前后端桥梁
- **SQLite** - 数据库（默认）
- **Laravel Pint** - 代码格式化

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Inertia.js** - SPA 体验
- **Tailwind CSS 4** - 样式框架
- **shadcn/ui** - 组件库
- **i18next** - 国际化

### 开发工具
- **Vite** - 构建工具
- **Pest** - PHP 测试框架
- **ESLint** - 代码检查

## 📦 安装部署

### 环境要求
- PHP >= 8.2
- Node.js >= 18
- Composer
- NPM 或 Yarn

### 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd rackroom
```

2. **安装依赖**
```bash
# 安装 PHP 依赖
composer install

# 安装 Node 依赖
npm install
```

3. **环境配置**
```bash
cp .env.example .env

# 编辑 .env 文件，修改以下关键配置
APP_NAME=RackRoom
APP_ENV=production
APP_URL=https://your-domain.com
APP_KEY=  # 留空，下一步会自动生成

# 数据库配置（默认 SQLite，无需修改）
# 如需 MySQL，取消注释并配置：
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=rackroom
# DB_USERNAME=root
# DB_PASSWORD=your_password

# Session 配置
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true  # HTTPS 环境下设为 true
SESSION_DOMAIN=null

# 生成应用密钥
php artisan key:generate
```

4. **数据库迁移**
```bash
# 创建数据库表
php artisan migrate

# 可选：填充测试数据（开发环境）
php artisan db:seed
```

5. **创建管理员账户**
```bash
# 启动服务后，访问 /register 创建第一个管理员账户
# 或手动创建（Tinker）
php artisan tinker
>>> \App\Models\User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => bcrypt('password'), 'email_verified_at' => now()])
```

6. **构建前端资源**
```bash
# 开发环境（带热重载）
npm run dev

# 生产环境（优化构建）
npm run build
```

7. **配置 Web 服务器**

**Nginx 配置示例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/rackroom.local.host/rackroom/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

**Apache 配置（使用 .htaccess）：**
```apache
# 确保 mod_rewrite 已启用
# 无需额外配置，项目已包含 public/.htaccess
```

8. **设置文件权限**
```bash
chmod -R 775 storage bootstrap/cache
chmod -R 775 storage/logs
chmod -R 775 storage/framework
chown -R www-data:www-data storage bootstrap/cache  # 根据实际 Web 服务器用户调整
```

9. **启动服务**
```bash
# 开发模式
composer run dev

# 或生产模式
php artisan serve
npm run build
```

### SSH WebSocket 服务（可选）

如需使用 SSH 终端功能，需要启动 WebSocket 服务：

```bash
php artisan ssh:websocket-server
```

> **注意**：WebSocket 服务默认监听端口 8901，请确保防火墙已开放该端口。

## 配置定时任务（重要）

系统依赖 Laravel 调度器执行自动检测等定时任务。

**快速配置（推荐）**
```bash
# 运行自动配置脚本，按提示选择运行方式
bash scripts/setup-scheduler.sh
```

**手动配置**

<details>
<summary>方式一：Cron（简单部署）</summary>

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每分钟执行）
* * * * * cd /www/wwwroot/rackroom.local.host/rackroom && php artisan schedule:run >> /dev/null 2>&1
```
</details>

<details>
<summary>方式二：Supervisor（生产环境推荐）</summary>

```ini
# /etc/supervisor/conf.d/rackroom-scheduler.conf
[program:rackroom-scheduler]
process_name=%(program_name)s
command=php /www/wwwroot/rackroom.local.host/rackroom/artisan schedule:work
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/rackroom-scheduler.log
```

```bash
supervisorctl reread
supervisorctl update
supervisorctl start rackroom-scheduler
```
</details>

<details>
<summary>方式三：手动运行（仅开发测试）</summary>

```bash
php artisan schedule:work
```
⚠️ 此命令需要保持运行，关闭终端后定时任务将停止
</details>

**验证定时任务**
```bash
# 检查定时任务状态
php artisan scheduler:status

# 手动执行一次自动检测（测试用）
php artisan devices:auto-detect --type=manual
```

**删除/停用定时任务**
```bash
# 运行配置脚本，选择选项 6 删除配置
bash scripts/setup-scheduler.sh

# 或直接删除 Cron 任务
crontab -l | grep -v "schedule:run" | crontab -
```

> ⚠️ **注意**：如果不配置定时任务，自动检测功能将无法正常运行。

### Docker 部署

```bash
# 使用 Laravel Sail
cd rackroom
./vendor/bin/sail up

# 执行迁移
./vendor/bin/sail artisan migrate
```

## 📖 使用说明

### 初始配置

1. 访问系统首页，注册管理员账户
2. 进入系统后，首先配置：
   - 机房信息
   - 机柜类型
   - 设备类型
   - 设备库

### 日常使用流程

1. **添加机房** → 设置机房位置和基本信息
2. **添加机柜** → 选择机柜类型和所属机房
3. **添加设备** → 从设备库选择设备或自定义
4. **可视化编辑** → 在机柜视图中拖拽设备
5. **监控告警** → 查看设备状态和告警信息
6. **生成报表** → 导出资产清单和使用率报表

### 快捷键

- `Ctrl/Cmd + K` - 快速搜索
- `双击设备` - 编辑设备信息
- `拖拽设备` - 移动设备位置

## 📁 目录结构

```
rackroom/
├── app/                    # 后端应用代码
│   ├── Http/
│   │   ├── Controllers/    # 控制器
│   │   └── Middleware/     # 中间件
│   ├── Models/             # Eloquent 模型
│   └── ...
├── bootstrap/              # 应用启动文件
├── config/                 # 配置文件
├── database/               # 数据库
│   ├── migrations/         # 迁移文件
│   └── seeders/            # 数据填充
├── public/                 # 公共资源
├── resources/              # 前端资源
│   ├── js/
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面组件
│   │   ├── locales/        # 国际化文件
│   │   └── ...
│   └── css/                # 样式文件
├── routes/                 # 路由定义
├── tests/                  # 测试文件
├── .env.example            # 环境变量示例
└── README.md               # 本文件
```

## 🔧 开发规范

### 代码风格
- PHP 代码遵循 PSR-12 规范
- 使用 Laravel Pint 自动格式化
- TypeScript 使用严格类型检查
- 组件使用函数式组件 + Hooks

### Git 提交规范
```
feat: 新功能
fix: 修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

### 分支管理
- `main` - 生产分支
- `develop` - 开发分支
- `feature/*` - 功能分支
- `fix/*` - 修复分支

## 🧪 测试

```bash
# 运行所有测试
php artisan test

# 运行特定测试
php artisan test --filter=DashboardTest

# 运行前端测试
npm run test
```

## 🚀 性能优化

- 启用 OPcache 加速 PHP
- 使用 Redis 缓存（可选）
- 数据库索引优化
- 前端资源压缩和懒加载

## ⚙️ 环境变量配置

| 变量名 | 说明 | 默认值 | 建议值 |
|--------|------|--------|--------|
| `APP_NAME` | 应用名称 | `Laravel` | `RackRoom` |
| `APP_ENV` | 运行环境 | `local` | `production` |
| `APP_KEY` | 应用密钥 | - | 运行 `key:generate` 生成 |
| `APP_URL` | 应用URL | `http://localhost` | 实际域名 |
| `DB_CONNECTION` | 数据库类型 | `sqlite` | `sqlite` 或 `mysql` |
| `SESSION_DRIVER` | Session驱动 | `database` | `database` 或 `redis` |
| `SESSION_LIFETIME` | Session有效期 | `120` | `120`（分钟） |
| `SESSION_SECURE_COOKIE` | 安全Cookie | `false` | `true`（HTTPS环境） |
| `SESSION_DOMAIN` | Cookie域名 | `null` | 域名或 `null` |
| `BROADCAST_CONNECTION` | 广播驱动 | `log` | `pusher`（实时功能） |
| `CACHE_STORE` | 缓存驱动 | `database` | `redis`（高性能） |
| `QUEUE_CONNECTION` | 队列驱动 | `database` | `redis` |

## 🔒 安全建议

1. 生产环境修改 APP_KEY
2. 配置 HTTPS
3. 定期备份数据库
4. 启用双因素认证
5. 设置适当的文件权限

## 🐛 故障排除

### CSRF Token Mismatch 错误

服务器迁移后出现 "CSRF token mismatch" 错误，按以下步骤解决：

```bash
# 1. 更新 .env 配置
APP_URL=https://your-new-domain.com  # 确保与新服务器地址匹配
SESSION_SECURE_COOKIE=true           # 如果使用 HTTPS，设为 true
SESSION_DOMAIN=null                  # 清除域名限制，让框架自动检测

# 2. 清除所有缓存
cd /www/wwwroot/rackroom.local.host/rackroom
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan optimize:clear

# 3. 重新生成应用密钥（如果迁移后未设置）
php artisan key:generate

# 4. 检查 sessions 表（如果使用 database 驱动）
php artisan migrate --force

# 5. 检查文件权限
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

# 6. 重新缓存配置（生产环境）
php artisan config:cache
```

**其他注意事项：**
- 让用户清除浏览器缓存和 Cookie，然后重新登录
- 如果跨域部署，检查 `SESSION_SAME_SITE` 设置（可选值：lax, strict, none）
- 确保 `APP_KEY` 与之前一致（用于解密数据库中的加密数据）

### 自动检测不执行

如果自动检测功能不工作，请检查：

```bash
# 检查定时任务状态
php artisan scheduler:status

# 查看定时任务日志
tail -f storage/logs/scheduler.log

# 确保定时任务在运行
ps aux | grep "schedule:work"
```

### 页面显示 500 错误

```bash
# 查看 Laravel 错误日志
tail -f storage/logs/laravel.log

# 检查数据库连接
php artisan db:monitor

# 运行数据库迁移
php artisan migrate --force
```

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📝 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新详情。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证开源。

## 🙏 致谢

- [Laravel](https://laravel.com) - 优秀的 PHP 框架
- [React](https://react.dev) - 前端框架
- [shadcn/ui](https://ui.shadcn.com) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com) - CSS 框架

---

<p align="center">
  Made with ❤️ by RackRoom Team
</p>
