# WeBox 部署说明（中间件、后端、前端）

本指南包含 macOS 本地运行和 Linux 单机生产参考。仓库提供配置模板；域名、TLS、服务器访问和实际发布需在目标环境落实，不表示已经部署。架构为 Nginx 静态站点/反向代理 → Spring Boot → 独立 MySQL / Redis，无需专门的 API Gateway。

## 1. 本地环境

准备 JDK 17、Node.js 22.12+、Docker 与 Compose v2、Python 3。macOS 可选择已安装版本：

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="/opt/homebrew/opt/node@22/bin:$JAVA_HOME/bin:$PATH"
java -version
node --version
docker compose version
```

在项目根目录初始化：

```sh
cp .env.example .env
./scripts/init-db.sh
```

脚本启动 MySQL 8.4 和 Redis 7，等待健康后按顺序执行 `schema.sql`、`phase2.sql`、`seed.sql`、`images.sql`、`inventory.sql`。MySQL `127.0.0.1:13306`，Redis `127.0.0.1:16379`，避免使用其他项目常用端口。MySQL 数据在 Compose 命名卷 `mysql_data`（实际名称带项目名前缀），重建容器保留数据；**不要使用 `docker compose down -v` 升级**。

`.env` 只给 Compose 替换变量，Spring Boot 不自动读取它。后端另外支持工作目录或上一级的被忽略文件 `.env.local.properties`，其内容应私密保留，不要提交或打印；生产推荐使用 systemd EnvironmentFile。修改 Compose 数据库密码不改变已初始化数据卷内用户密码，需在数据库中单独修改并同步后端。

后端终端：

```sh
cd backend
./mvnw spring-boot:run
```

默认端口 8080，默认数据库为 `webox`，开发用户名/密码见 `.env.example`。生产必须替换。首次创建超级管理员时，私下设置 `WEBOX_ADMIN_EMAIL`、`WEBOX_ADMIN_PASSWORD` 再启动；不存在则创建，已有同邮箱则提升角色并保留原密码，后续删除这两个变量。不设置变量不会创建默认特权账号。普通注册不能获得 Console 权限。

AI 推荐需在后端设置 `DEEPSEEK_API_KEY`，默认模型 `deepseek-flash`。不要通过 `VITE_*` 或其他前端变量传密钥。

前端另一终端：

```sh
cd frontend
npm ci
npm run dev
```

访问 `http://127.0.0.1:5173/`，Console 为 `/console`。Vite 将 `/api`、`/uploads` 代理到 8080；改变后端端口须同步 `frontend/vite.config.ts`。上传文件按进程当前目录落在 `uploads/`，从 backend 启动即 `backend/uploads/`。

停止：终端 Ctrl+C 停止前后端，根目录执行 `docker compose stop` 保留中间件数据。Redis 配置禁用磁盘持久化，重建/重启将丢失登录态和菜单缓存，这是预期行为；MySQL 和图片需要永久备份。

## 2. 构建与验证

```sh
cd backend
./mvnw test
./mvnw package
cd ../frontend
npm ci
npm run build
```

产物是 `backend/target/webox-backend-0.0.1-SNAPSHOT.jar` 和 `frontend/dist/`。当前已验证 18 项后端测试、前端生产构建以及 5 项 Chrome 流程通过。

在真实依赖和应用启动后，于项目根运行：

```sh
python3 scripts/verify-db.py
python3 scripts/verify-business.py
python3 scripts/verify-phase2.py
python3 scripts/verify-inventory.py
python3 scripts/verify-ai.py
cd frontend
npm run test:e2e
```

测试会创建测试用户、订单和下架测试菜品；未来日期用于隔离菜单测试。Console 测试需要匹配当前环境的超级管理员，不能把演示账号照搬到生产。Playwright 默认本机 Chrome；若改用 Chromium，安装对应浏览器并调整配置。

发布验收还应覆盖：刷新恢复身份、300 秒固定过期、越权 403、跨用户订单不可读、跨日期无库存不可加购、多人抢最后库存只有合法数量成功、同 requestId 重试不重复扣减、取消重试只回补一次、Console 不能减少到已售以下、Redis 异常返回受控错误、缓存过期后恢复、AI SSE 实际分段结果及错误、上传和 SPA 深链接。本次真实验收已通过：10 用户争抢 3 份库存恰好成功 3 单；verify-ai.py 实际 DeepSeek 返回 3 张卡片；Chrome 包含真实推荐与跨浏览器售罄/退款。生产部署后仍需在目标环境复验。

## 3. Linux 服务器目录与权限

参考 Ubuntu/Debian，已安装 JDK 17、Nginx、Docker/Compose；构建可在 CI 或本机构建后上传，不要求服务器安装 Node。参考布局：

```text
/opt/webox/infra/             compose.yaml、database/、scripts/、私密 .env
/opt/webox/backend/app.jar    Spring Boot 产物
/opt/webox/backend/uploads/  持久上传图片
/opt/webox/frontend/dist/    前端静态产物
/etc/webox/backend.env      私密后端变量
```

管理员执行：

```sh
sudo useradd --system --home-dir /opt/webox --shell /usr/sbin/nologin webox
sudo install -d -o root -g root -m 755 /opt/webox /opt/webox/infra /opt/webox/frontend
sudo install -d -o webox -g webox -m 750 /opt/webox/backend /opt/webox/backend/uploads
sudo install -d -o root -g root -m 700 /etc/webox
```

如账号已存在则不重复创建。将 compose.yaml、database/、scripts/init-db.sh、.env.example 复制到 `/opt/webox/infra` 对应位置；权限由管理员管理。配置 `.env` 中真实数据库密码并 `chmod 600 .env`，不要提交。只允许服务器本机访问中间件；仓库 Compose 已绑定 `127.0.0.1`。外部防火墙仅开放网站所需端口，8080 不应对公网开放。

```sh
cd /opt/webox/infra
sudo docker compose up -d --wait mysql redis
sudo ./scripts/init-db.sh
sudo docker compose ps
```

此处脚本由 root 使用 Docker，普通 webox 服务账号无需 Docker 权限。首次启动检查数据库和 Redis 健康，生产升级务必先备份再运行迁移。Compose 只自动初始化基础 schema/seed，必须运行脚本补齐 phase2 和 inventory，不能只执行 compose up。

## 4. 后端 systemd

把构建 jar 安装到 `/opt/webox/backend/app.jar`，确保 webox 可读。复制模板并私下修改：

```sh
sudo install -o root -g root -m 600 deployment/backend.env.example /etc/webox/backend.env
sudo install -o root -g root -m 644 deployment/webox.service /etc/systemd/system/webox.service
```

设置实际 `DB_PASSWORD` 和 `DEEPSEEK_API_KEY`；如改端口，同步 DB_URL、REDIS_PORT。默认 JDBC URL 包含 `connectionTimeZone=Asia/Shanghai`。环境变量模板不是 shell 脚本，不需要写 `export`。systemd 以 root 读取 600 文件，再以 webox 身份启动；工作目录固定 `/opt/webox/backend`，保证图片路径稳定。

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now webox
sudo systemctl status webox --no-pager
curl --fail http://127.0.0.1:8080/api/health
sudo journalctl -u webox -n 100 --no-pager
```

健康接口同时检查 MySQL/Redis，失败返回 503，不检查 AI 密钥有效性。日志排障只查看必要内容，禁止输出凭据、Authorization 或完整私密配置。可选 bootstrap 管理员创建后移除变量并重启。

## 5. 前端与 Nginx

将 `frontend/dist` 的文件复制到 `/opt/webox/frontend/dist`。目录至少 755，文件 644，使 Nginx 工作用户可读。复制配置（按实际发行版路径调整）：

```sh
sudo install -m 644 deployment/nginx.conf /etc/nginx/conf.d/webox.conf
sudo nginx -t
sudo systemctl reload nginx
```

将 `example.com` 替换为真实域名，并检查默认站点冲突。配置提供 SPA `try_files $uri $uri/ /index.html`；`/api/` 保留原路径代理 8080，关闭代理缓存和缓冲并将读取超时设为 75 秒，保证 POST AI SSE 分段到达；`/uploads/` 交给后端提供文件。上传请求上限 6MB，后端单文件仍是 5MB。

模板仅 HTTP：公开前为真实域名配置有效证书、HTTPS 443 与 HTTP 重定向；证书路径和签发方式依据服务器实际选择，不要直接使用占位证书。检查 HTTPS 下登录、Console、上传图片、刷新 `/orders` 等深链接和 AI SSE。Nginx 不承担业务权限、库存或 API 网关逻辑。

## 6. 备份、迁移、更新与回滚

MySQL 命名卷持久化不等于备份。维护窗口停止后端写入，备份 MySQL 与 uploads，并将备份存放到受限目录及异机。以下在 `/opt/webox/infra` 执行；备份包含用户信息，应限制读取：

```sh
sudo systemctl stop webox
umask 077
mkdir -p backups
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -u"$MYSQL_USER" --single-transaction --no-tablespaces --routines --triggers "$MYSQL_DATABASE"' > backups/webox.sql
tar -czf backups/uploads.tar.gz -C /opt/webox/backend uploads
```

执行命令的管理员须有 Docker 权限和上传目录读取权限。确认导出退出码为 0、SQL 非空，记录应用版本与迁移版本；保持数据库停止写入直至备份完整。恢复优先在隔离数据库验证，停后端后才恢复生产。已有表恢复须先备份当前状态并明确覆盖范围，不应盲目对线上混合导入：

```sh
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"' < backups/webox.sql
```

恢复 uploads 时使用经过验证的备份，在停写时还原到同一路径并恢复 `webox:webox` 属主，不覆盖未备份的新图。确认 MySQL/图片时间点一致后再启动应用；Redis 缓存可删除指定受影响日期键或等待 45 秒过期，不要对共用 Redis 运行 FLUSHALL。

更新流程：备份 → 停旧后端 → 迁移 → 安装新 jar 和 dist → 启动 → 健康与业务验收。**先停止旧 Java 进程再覆盖 jar**，运行中替换 jar 可导致延迟加载类失败。迁移运行项目初始化脚本即可执行补列/索引，脚本保留业务数据，但 DDL 仍需维护窗口和备份。不要通过删表、删数据卷“修复”升级。正式更新可保留上一版 jar/dist 到版本目录，再复制当前文件。

```sh
sudo systemctl stop webox
cd /opt/webox/infra
sudo ./scripts/init-db.sh
# 在此安装已经构建并验证的新 app.jar 和 dist；保留旧版用于回滚。
sudo systemctl start webox
curl --fail http://127.0.0.1:8080/api/health
```

回滚代码同样先停服务再安装旧产物。数据库迁移通常向前兼容，但必须核对旧代码是否理解新库存字段；不要盲目执行反向 SQL 或重跑库存回填。确需恢复数据库时，需要停写并连同图片恢复到已验证的一致备份点，这会丢失备份后的业务数据，须由业务负责人决定。完成后重验订单幂等、剩余库存和取消回补。

## 7. 常见排障

| 现象 | 检查 |
| --- | --- |
| health 503 | Compose 健康、端口、实际数据卷密码、DB_URL 和 Redis 连接 |
| 菜单 MENU_RETRY | Redis 可用性、日期缓存重建锁；接口受控失败，不应绕过 Redis 放大 MySQL 压力 |
| Console 403 | 必须 SUPER_ADMIN；提升后退出再登录 |
| 登录约 5 分钟后过期 | 固定 300 秒设计，无滑动续期 |
| AI error / 无输出 | 后端私密 key、模型权限、网络/额度、上游返回码；禁止伪造静态回退 |
| AI 一次性到达 | Nginx/CDN 是否缓冲 SSE、超时是否足够；应用真实 POST 流 |
| 旧图片 404 | 工作目录是否变更、uploads 是否随迁移保存、文件权限 |
| 库存短时旧值 | 2 秒轮询加 30–45 秒缓存最终一致；下单以 MySQL 条件更新为准 |

GitHub 发布前检查 `.env`、`.env.local.properties`、私密环境文件、运行日志和对话原件均未暂存。真实 API key 仅保存在服务器受限配置中。原始对话要求与敏感信息处理方式见 [技术说明](technical-guide.md)。
