<!--
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-02-10 00:31:30
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 06:54:40
 * @FilePath: /godlytools/README.MD
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
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
