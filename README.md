# RackRoom - 机房设备管理系统

<p align="center">
  <img src="public/favicon.ico" alt="RackRoom Logo" width="80" height="80">
</p>

<p align="center">
  <strong>专业的数据中心机房设备管理解决方案</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#安装部署">安装部署</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#开发规范">开发规范</a>
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
php artisan key:generate
```

4. **数据库迁移**
```bash
php artisan migrate
php artisan db:seed  # 可选：填充测试数据
```

5. **构建前端资源**
```bash
npm run build
```

6. **启动服务**
```bash
# 开发模式
composer run dev

# 或生产模式
php artisan serve
npm run build
```

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

## 🔒 安全建议

1. 生产环境修改 APP_KEY
2. 配置 HTTPS
3. 定期备份数据库
4. 启用双因素认证
5. 设置适当的文件权限

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
