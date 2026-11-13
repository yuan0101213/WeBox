# WeBox

企业员工点餐系统：React SPA → JDK 17 Spring Boot → 独立 MySQL；Redis 保存固定 5 分钟登录态。

## 功能

- 注册登录、刷新恢复登录、退出、Redis 固定 300 秒过期。
- 每日菜单、名称/描述搜索、多菜系筛选、分页、配置和加料。
- 按用户本地保存购物车、配置合并、整数分计价、结算、历史地址。
- 事务下单、请求重试幂等、订单快照、本人订单查询与 Pending 取消。
- 偏好设置：过敏原加购确认、菜系/辣度推荐排序高亮、口味和预算软提示。
- 订餐规则：总份数最多 5、上海时间午餐 10:00 / 晚餐 15:00 截单自动切换、同日同餐次有效订单唯一。
- Console：**仅 SUPER_ADMIN** 可进入，EMPLOYEE不可进入；菜品增改、上下架、图片上传、每日菜单与供应数量。
- 前端保持基础表单与卡片；初始菜单仅 3 张小图，无装饰图片，管理员新上传图片正常展示。

- 库存：MySQL 条件扣减防超卖、取消回补；Redis 日期菜单缓存、回源锁、延迟双删；页面每 2 秒自动更新余量、低库存和售罄状态。
- AI：实际接入 DeepSeek `deepseek-flash`，根据菜单、偏好和近 7 天菜品记录流式返回卡片；后端过滤过敏原和售罄菜品。

本期不包含经营看板。

## 本地演示

- 员工端：[http://127.0.0.1:5173/](http://127.0.0.1:5173/)，可自行注册。
- Console：[http://127.0.0.1:5173/console](http://127.0.0.1:5173/console)。
- 本次本地演示超级管理员：`superadmin@webox.test` / `WeBoxAdmin123`。
- 普通注册只能生成 EMPLOYEE；不能通过请求角色字段获得 Console 权限。

## 环境与启动

需要 JDK17、Node22.12+、Docker/Compose v2、Python3（验证脚本）。

macOS 可选择本机已安装版本：

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="/opt/homebrew/opt/node@22/bin:$JAVA_HOME/bin:$PATH"
```

### 数据库

项目根目录：

```sh
cp .env.example .env
./scripts/init-db.sh
```

脚本启动项目专属容器并顺序执行 `schema.sql`、`phase2.sql`、`seed.sql`、`images.sql`、`inventory.sql`，等待服务就绪。可以重复运行，保留已有用户、订单、菜品改动和自定义图片。不要通过删除数据卷升级。

| 服务 | 地址 | 本地默认值 |
| --- | --- | --- |
| MySQL 8.4 | `127.0.0.1:13306` | 数据库 `webox`，用户 `webox`，密码 `webox_dev` |
| Redis 7 | `127.0.0.1:16379` | 无密码，仅本地监听 |

6 张表：`users`、`dishes`、`daily_menu_items`、`orders`、`order_items`、`user_preferences`。种子包含 9 个英文菜品和执行当天/次日菜单，每日供应数量默认 50，库存迁移只在首次增加余量字段时初始化，不会因重复执行而重置库存。

`.env` 只供 Compose 使用，Spring Boot 不自动读取；如修改端口或凭据，同步设置后端环境变量。现有数据卷的 MySQL 密码不会随 `.env` 自动变更。

### 后端

```sh
cd backend
# 首次需要创建本地超级管理员时，显式提供以下环境变量
WEBOX_ADMIN_EMAIL=superadmin@webox.test WEBOX_ADMIN_PASSWORD=WeBoxAdmin123 ./mvnw spring-boot:run
```

账号保存于 MySQL；以后可不传变量直接运行 `./mvnw spring-boot:run`。指定已有邮箱会将其提升为 SUPER_ADMIN 并保留原密码。默认不创建任何特权账号。

后端默认 `8080`。配置变量：`SERVER_PORT`、`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`REDIS_HOST`、`REDIS_PORT`；默认连接上述 WeBox 服务。JDBC URL 默认 `jdbc:mysql://localhost:13306/webox?connectionTimeZone=Asia/Shanghai&characterEncoding=UTF-8`。

上传目录是后端进程当前工作目录的 `uploads/`；如从 `backend/` 启动则为 `backend/uploads/`。保持启动目录一致以读取已有文件。支持 JPEG/PNG/WebP，最大 5MB。

### DeepSeek 配置

```sh
# 项目根目录；填写自己的密钥，不要提交该文件
cp .env.local.properties.example .env.local.properties
chmod 600 .env.local.properties
```

填写 `deepseek.api-key`，模型默认 `deepseek-flash`。也可使用部署环境变量 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` 和 `DEEPSEEK_BASE_URL`。Spring Boot 从项目根目录或 backend 的上级加载本地属性文件。前端不持有该密钥。AI 会将菜品、饮食偏好、近7天菜品 ID 和输入需求发送到 DeepSeek，不发送邮箱、地址、订单编号或登录 Token。

### 前端

另一终端：

```sh
cd frontend
npm ci
npm run dev
```

Vite `/api` 和 `/uploads` 代理至 `http://127.0.0.1:8080`。改后端端口时同步修改 `frontend/vite.config.ts`。页面刷新通过 sessionStorage Token 恢复身份，Redis TTL 不续期；过期后重新登录，本人购物车草稿保留。

### 构建与测试

```sh
# 项目根目录；运行中的真实 MySQL/Redis 和前后端是 API 测试的前提
python3 scripts/verify-db.py
python3 scripts/verify-business.py
python3 scripts/verify-phase2.py
python3 scripts/verify-inventory.py
# 下列命令会真实调用已配置的 DeepSeek 服务
python3 scripts/verify-ai.py

cd backend
./mvnw test
./mvnw package

cd ../frontend
npm run build
npm run test:e2e
```

浏览器测试默认使用本机 Chrome，其中库存/AI 测试会真实调用 DeepSeek，需要有效密钥。未安装 Chrome 时可安装 Playwright Chromium 并修改 `playwright.config.ts` 的 channel 配置。API/浏览器测试会创建测试用户和取消的测试订单，以及下架的测试菜品；测试每日菜单使用未来单独日期，不覆盖当前演示菜单。

`verify-phase2.py` 和 Console 浏览器测试使用上面的本地演示超级管理员；其他环境修改测试账号即可。金额、选项、截单边界、数据库约束、幂等和权限均有验证脚本。

停止基础设施但保留数据：`docker compose stop`。开发进程在各自终端 Ctrl+C 停止；Redis 重启会清空所有登录态。

## 文档

- [第一阶段技术设计](docs/phase-1-technical-design.md)（历史设计，后续阶段覆盖其“暂不实现”条目）
- [第二阶段实施计划](docs/superpowers/plans/2026-11-13-phase2.md)
- [完整技术文档](docs/technical-guide.md)
- [完整部署文档：中间件、后端、前端](docs/deployment-guide.md)
- [API 文档](docs/api.md)
- [运行截图](docs/screenshots/)
- [codex记录](WeBox-conversation-2026-11-13.md)

AI 完整原始对话请通过所使用工具原生导出至 `ai-conversations/`，本 README 和技术文档不替代对话导出。

最终验证：18 个后端单元测试通过；5 个 Chrome 端到端流程通过，包含真实 DeepSeek SSE 和双浏览器库存更新；10 个账号争抢 3 份只产生 3 单，取消回补及数据库/Redis 余量检查通过。
