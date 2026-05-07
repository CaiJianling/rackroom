# 安装Composer依赖
```bash
composer install
```
# 安装npm依赖
```bash
npm install
```
# 创建.env文件
```bash
cp .env.example .env
php artisan key:generate
```
# 执行dev命令：
```bash
composer run dev
```
# 打包命令：
```bash
npm run build
```
# 格式化项目所有文件，并输出 agent 格式的 JSON 结果
```bash
vendor/bin/pint --format agent
```
# 重启服务
```bash
php artisan config:clear
php artisan cache:clear
```
# 运行服务
```bash
php artisan serve
```
# 运行测试
```bash
php artisan test
```
