# WeBox 完整技术说明

本文描述当前仓库实现，覆盖第一、二阶段以及第三阶段的库存、缓存和 DeepSeek 推荐。历史设计中的“暂不实现”不代表当前范围。产品页面使用英文，本文使用中文。当前没有经营分析看板。

## 1. 架构与目录

浏览器 React + TypeScript + Ant Design SPA 经 HTTP 调用 Java 17 / Spring Boot 3.5.7。MySQL 8.4 是用户、菜单、订单、偏好与库存的事实来源；Redis 7 保存登录态和短期菜单快照。无独立 API Gateway，生产 Nginx 仅提供静态文件和反向代理。

- `frontend/`：员工菜单、购物车、结算、订单、偏好、AI 推荐与 Console。
- `backend/`：Controller 接口、Service 业务和 Repository JDBC；无 ORM 自动建表。
- `database/`：基础表、阶段迁移、种子和图片脚本。
- `scripts/`：初始化和业务验证。
- `deployment/`：Nginx、systemd、后端环境变量参考；部署步骤见 [部署指南](deployment-guide.md)。

页面采用基础表单与卡片，初始菜品仅使用 3 张小图，不添加装饰图片；管理员上传的图片可正常展示。

## 2. 功能与业务规则

注册创建 EMPLOYEE，密码用 BCrypt；登录 Token 存在 sessionStorage，刷新可恢复身份。Redis 登录态固定 300 秒，不因访问或刷新续期。注销删除会话。购物车按用户保存在浏览器本地，过期登录不会删除草稿。

菜单支持日期、名称/描述搜索、多菜系、分页、按偏好排序；菜品有选项组、必选项、加料和数量。所有金额使用整数人民币分（`priceFen`、`totalFen` 等），服务端重新计算价格，拒绝信任客户端价格。购物车相同菜品与选项组合合并。过敏原加购需确认，偏好提供菜系、辣度、口味和预算提示。

单次最多 5 份。上海时区 `Asia/Shanghai` 午餐 10:00、晚餐 15:00 截单，等于截止时间即关闭；服务端计算最近可用餐次。每用户/配送日/餐次最多一张 Pending 或 Confirmed 订单。用户只能读取本人订单，仅 Pending 可取消，重复取消成功且只回补一次库存。订单保留菜名、选项、单价和小计快照；更改菜品不改变历史账单。

Console **仅 SUPER_ADMIN** 可访问，ADMIN 与 EMPLOYEE 同样无权进入。后端逐请求校验权限。支持菜品创建修改、上下架、JPEG/PNG/WebP 图片上传（文件上限 5MB）、指定日期菜单和供应量维护。上传文件位于后端工作目录的 `uploads/`，通过 `/uploads/` 提供。

## 3. 数据模型

全部业务表使用 InnoDB。JSON 保留选项与偏好结构，外键维护关联；不能通过删除数据卷升级。

| 表 | 主要字段 | 约束与用途 |
| --- | --- | --- |
| `users` | `id,email,password_hash,role,created_at` | email 唯一；role 为 EMPLOYEE/ADMIN/SUPER_ADMIN |
| `dishes` | `id,name,description,price_fen,category,image_url,proteins_json,allergens_json,spice_level,option_groups_json,active` | 金额非负；菜系和辣度 CHECK 枚举 |
| `daily_menu_items` | `id,menu_date,dish_id,supply_quantity,remaining_quantity` | 日期+菜品唯一，dish 外键；库存按日期共享，不分午晚餐 |
| `orders` | `id,order_no,user_id,request_id,request_hash,delivery_date,meal_period,address,status,total_fen,created_at,active_slot,stock_deducted` | 订单号唯一；user+request 唯一；有效餐次唯一；金额非负；状态与餐次 CHECK |
| `order_items` | `id,order_id,dish_id,dish_name,options_json,unit_price_fen,quantity,subtotal_fen` | 订单/菜品外键；数量正数；小计=单价×数量 |
| `user_preferences` | `user_id,preferences_json` | user 主键及外键 |

`active_slot` 是生成列：Pending/Confirmed 为 1，其他状态为 NULL；唯一索引 `(user_id,delivery_date,meal_period,active_slot)` 利用 NULL 可重复的性质释放取消后的餐次。

初始化顺序是 `schema.sql → phase2.sql → seed.sql → images.sql → inventory.sql`。基础脚本使用 `CREATE TABLE IF NOT EXISTS`，不替代升级；phase2 按元数据补列和索引。inventory 只在首次添加 `remaining_quantity` 时，按既有 Pending/Confirmed/Completed 订单汇总消耗并回填库存与 `stock_deducted`，之后重复运行不会重置销售库存。种子为 9 道英文菜、执行当天/次日菜单，默认供应 50；图片脚本保留自定义图片。上线前应备份并检查存量有效订单是否冲突。

## 4. 下单一致性、并发与缓存

`requestId` 为一次提交及其重试的稳定标识。同用户、同 requestId、相同规范化请求返回已有订单；换内容复用返回 `REQUEST_ID_REUSED`。订单、明细、库存扣减在一个事务内提交。按菜品 ID 排序后执行条件更新：

```sql
UPDATE daily_menu_items
SET remaining_quantity = remaining_quantity - ?
WHERE menu_date = ? AND dish_id = ? AND remaining_quantity >= ?;
```

影响行数不是 1 即 `409 INSUFFICIENT_STOCK`，事务回滚全部扣减；MySQL 是最后库存防线。有效餐次唯一索引与请求唯一索引处理并发冲突。取消锁定订单，根据状态和 `stock_deducted` 回补并清除标记，重复调用不重复补货。Console 不允许删除已有消耗的菜单项，也不允许把供应量减到已售数量以下。

菜单缓存键为 `webox:menu:v3:YYYY-MM-DD`，TTL 随机 30–45 秒；`键:lock` 使用 SET NX，10 秒过期，以随机令牌及 Lua 比较删除锁。未获锁请求最多等待 8×40ms；Redis 故障或等待失败返回 `503 MENU_RETRY`，避免所有请求直接回源 MySQL。搜索、排序和分页基于日期快照。

修改库存、菜单或关联菜品时，写前删除缓存，事务提交后立即再删并在 500ms 后延迟删除；失败删除有有限重试。它是短期最终一致方案，进程崩溃可能丢失延迟任务，慢读/重建竞态仍可能留下旧值直至 TTL 到期，**不是严格强一致缓存**。页面库存约每 2 秒请求 `/api/inventory?date=...`，读取 Redis 快照，未使用 SSE 推库存；真正结算始终检查 MySQL。日期快照无对应菜品时应视为不可用，不能沿用其他日期库存。

### 连续点击与提交幂等

前端为当前结算草稿保留稳定 UUID（`requestId`），同步提交锁覆盖 React 状态更新前的重复事件；超时、刷新或尚未跳转时不换 ID。同一草稿编辑后仍沿用 ID，防止上一单结果未知时再创建一单。后端由 `UNIQUE(user_id, request_id)` 兜底，而不是依赖前端按钮或查询判断。完整生命周期、数据库并发路径与验证方法见 [下单幂等技术方案](order-idempotency.md)。

## 5. API 与流式 AI

普通成功响应为 `{data:...}`，错误为 `{code,message}`；除 health、注册、登录外均需 `Authorization: Bearer <token>`。完整基础字段见 [API 文档](api.md)。

| 方法与路径（均以 `/api` 开头） | 请求与结果 |
| --- | --- |
| `GET /health` | MySQL/Redis 检查，依赖故障 503 |
| `POST /auth/register`、`POST /auth/login` | `{email,password}`；登录返回 `{token,expiresIn:300,user}` |
| `GET /auth/me`、`POST /auth/logout` | 身份恢复、注销 |
| `GET /menu` | `date,keyword,categories,page,pageSize,recommend`；`{items,total,page,pageSize,date}` |
| `GET /dishes/{id}` | 已上架菜品详情，不接受 date 参数；日期库存另取 inventory |
| `GET /inventory?date=YYYY-MM-DD` | `{date,items:[{dishId,remainingQuantity,supplyQuantity}]}` |
| `GET/PUT /preferences` | `{allergens,cuisines,spiceLevel,taste,budgetMinFen,budgetMaxFen}` |
| `GET /addresses` | 本人历史去重地址，最多 20 |
| `GET /checkout/availability` | `deliveryDate,mealPeriod`；返回 `{deliveryDate,mealPeriod,adjusted,existingOrderId}` |
| `POST /orders` | `{requestId,deliveryDate,mealPeriod,address,items:[{dishId,quantity,selectedOptions:[{groupId,optionId}]}]}` |
| `GET /orders`、`GET /orders/{id}` | 分页本人订单、详情 |
| `POST /orders/{id}/cancel` | Pending 取消并回补 |
| `GET/POST /console/dishes`、`PUT /console/dishes/{id}` | 查询、创建、更新菜品 |
| `PATCH /console/dishes/{id}/status` | `{active:boolean}` |
| `GET /console/menu?date=...`、`PUT /console/menu` | 查询、提交 `{date,items:[{dishId,supplyQuantity}]}` |
| `POST /console/images` | multipart `file`，返回 `{url}` |
| `POST /recommendations` | `{prompt,date}`，prompt 最多 500 字符；返回 `text/event-stream` |

AI 默认使用 `DEEPSEEK_MODEL=deepseek-flash`、`DEEPSEEK_BASE_URL=https://api.deepseek.com`，后端持有 `DEEPSEEK_API_KEY`，向 `/chat/completions` 发起真实 `stream:true` 请求。浏览器使用 POST fetch 读取 SSE，事件为 `status`、`recommendation`（`{dish,reason}`）、`done`、`error`。不采用只能 GET 的原生 EventSource。

服务端从指定日期已上架且有库存的菜品选候选，硬过滤保存的过敏原。近 7 天是上海今天及前 6 天的非取消订单；存在未点过候选时排除近期重复，全部重复时保留可选菜。偏好、预算、口味和用户请求交给模型，提示词增加 priceCny/budgetCny 人民币元字段以避免“分”与“元”混淆；预算等属于推荐指导，不是确定性价格约束。上游输出按增量内容组装 JSON 行，仅接受候选内、未重复、非空理由且最多 3 道菜；发出前再次查库确认上架、库存和过敏原。推荐不锁库存，下单仍可能售罄。

工作线程 4、队列 8；传输线程 2、队列 32；连接超时 8 秒、上游请求 45 秒、整体 watchdog 55 秒、SseEmitter 60 秒。客户端断开/超时会取消任务并关闭流。缺少密钥、模型错误、无有效模型输出、队列满等返回真实错误，不以静态推荐伪装 AI 成功。

## 6. 验证与交付边界

当前验证已通过：18 项后端单元测试、前端生产构建、5 项 Chrome 流程（包含真实 DeepSeek 与跨浏览器售罄/退款）、10 用户争抢 3 份库存恰好成功 3 单的并发验证，以及真实 DeepSeek 返回 3 张推荐卡片的 verify-ai.py 验证。执行方法见部署指南。服务可部署不等于已经完成服务器发布或 TLS 配置。

原始需求要求保存 AI 完整对话。仓库文档不是对话原文，也不能生成虚假导出；须用原生工具导出。由于原始对话含敏感凭据，完整原件应私密保管，公开 GitHub 只能上传经过密钥脱敏的副本，并明确记录脱敏；不能同时满足“公开未经修改原文”和“保护已泄露密钥”，原件不得公开。不要将密钥放入前端、日志、截图、导出或 Git。
