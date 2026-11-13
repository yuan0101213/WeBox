# WeBox 第一阶段技术方案（简化 CRUD 版）

- 日期：2026-11-13
- 需求依据：`WeBox-PRD-候选人交付包/AI Vibe Coding V3.0 - PRD.md`
- 本期目标：优先打通注册、登录、菜单浏览与搜索、购物车、下单及订单查询取消。
- 本文为技术设计，不代表功能已经实现。

## 1. 本次调整

按本次需求，第一阶段采用简单页面和 CRUD 服务完成业务闭环：

- 前端使用基础组件，不建设组件库，不做复杂视觉、动画或交互抽象。
- SPA 直接调用 Spring Boot，不引入网关、Nginx、微服务或独立鉴权服务。
- 登录使用 Redis，登录态固定保存 5 分钟。
- 不引入 Spring Security、CSRF 体系、复杂权限体系、限流或监控平台。
- 保留业务必需的输入校验、密码哈希、服务端计价、订单事务和简单防重复提交。
- MySQL 作为独立服务持久化业务数据；Redis 仅保存登录态。

此前考虑的方案中，本期选择“简单 SPA + CRUD 单体服务 + MySQL + Redis 登录态”；暂不采用包含菜单缓存、持久化购物车、独立报价流程及完整安全体系的方案，以减少联调和部署工作。

## 2. 功能边界

| 模块 | 本期实现 |
| --- | --- |
| 注册登录 | 邮箱注册、密码登录、退出、查询当前用户、5 分钟到期后重新登录 |
| 菜单 | 当日菜单、图片与价格、名称/描述搜索、菜系多选、简单分页 |
| 菜品详情 | 描述、成分、过敏原、辣度、自定义选项、加价展示 |
| 购物车 | 添加、数量修改、删除、总价、按菜品与配置合并、本地保存 |
| 下单 | 配送日期、Lunch/Dinner、地址、提交、成功结果 |
| 订单 | 本人订单列表、详情、取消 Pending 订单 |
| 地址 | 从历史订单提取本人历史地址，无独立地址管理页面 |

暂不实现 Console、菜品管理后台、饮食偏好、每单 5 份限制、截单自动切换、同餐次有效订单唯一、库存扣减、实时推送、AI 推荐、经营看板和支付。菜单通过初始化数据提供，无需为展示数据额外建设管理 CRUD 页面。

PRD 中管理员角色仅预留 `role` 字段，本期注册固定为 `EMPLOYEE`，不开放角色选择或管理员功能。所有面向用户的页面、菜单数据和提示均使用英文。

## 3. 技术架构

```text
React SPA（Vite）
    │ HTTP / JSON，携带登录 Token
    ▼
Spring Boot（JDK 17）
    ├── MySQL：用户、菜单、订单
    └── Redis：登录 Token → 用户 ID，TTL 300 秒
```

| 层次 | 选型 | 用途 |
| --- | --- | --- |
| 前端 | React + TypeScript + Vite | SPA 页面 |
| 组件 | Ant Design 基础组件 + 少量 CSS | 表单、按钮、卡片、抽屉、列表 |
| 路由 | React Router | 页面切换 |
| 请求 | Axios | API 调用，统一附带 Token 和处理 401 |
| 状态 | React Context + useReducer | 共享购物车；普通页面用 useState |
| 后端 | JDK 17 + Spring Boot 3.5.x + Maven | REST API |
| 持久层 | Spring JDBC | 简单参数化 SQL CRUD |
| 数据库 | 独立 MySQL 8.x，InnoDB | 业务数据持久化 |
| 登录存储 | Spring Data Redis + 独立 Redis | 5 分钟登录态 |
| 密码 | spring-security-crypto 的 BCrypt | 仅使用密码工具，不引入 Security 过滤器体系 |

本期不使用 TanStack Query、Zustand、Caffeine、Spring Session、Flyway 和独立报价接口。数据库使用版本化 SQL 文件初始化，README 记录执行顺序。

## 4. 项目结构

```text
WeBox/
├── frontend/
│   ├── public/product-images/
│   └── src/
│       ├── api/
│       ├── components/       # AppLayout、DishCard、CartPanel
│       ├── pages/            # Login、Register、Menu、Checkout、Orders、OrderDetail
│       ├── context/          # AuthContext、CartContext
│       └── types/
├── backend/
│   └── src/main/
│       ├── java/.../
│       │   ├── controller/
│       │   ├── service/
│       │   ├── repository/
│       │   ├── dto/
│       │   └── common/       # 登录拦截器、异常响应
│       └── resources/application.yml
├── database/                 # schema.sql、seed.sql
├── docs/
├── ai-conversations/
├── compose.yaml              # 独立 MySQL、Redis
└── README.md
```

只采用 Controller → Service → Repository 三层，不引入 DDD、事件总线或通用 CRUD 框架。

## 5. 前端页面与素材

### 5.1 页面

- `/login`、`/register`：简单邮箱、密码表单。
- `/menu`：搜索框、菜系多选、菜品卡片、分页；详情通过 Modal 展示，购物车通过 Drawer 展示。
- `/checkout`：购物车明细、日期、餐次、历史地址下拉及新地址输入、提交按钮。
- `/orders`：订单列表，显示编号、日期、餐次、金额、状态。
- `/orders/:id`：订单明细、配置、配送信息及取消按钮。下单成功后直接进入该页并显示成功提示。

布局以基础可用为准：桌面多列卡片，手机单列或双列；不制作单独的移动端应用。

### 5.2 图片

使用已有 `WeBox-PRD-候选人交付包/product_images/` 下的 20 张 JPG，实施时复制到 `frontend/public/product-images/`。数据库保存 `/product-images/实际文件名.jpg`，不保存开发机器绝对路径。

初始化时人工确认图片和菜品的对应关系；图片加载失败显示统一占位图。本期不做图片上传或对象存储。

### 5.3 购物车

- 使用 Context + reducer，localStorage 按用户 ID 保存，刷新可恢复。
- 条目标识为 `dishId + 排序去重后的 optionValueIds`。
- 同菜品同配置增加数量，不同配置各占一行。
- 每次主动点击加购都累加，通过 reducer 避免连续点击丢失更新。
- 前端金额全部使用整数分计算，展示时格式化为 `¥22.50`。
- 退出或到期后清理内存中的当前用户信息与购物车；本地草稿保留在原用户命名空间，重新登录同一账号可恢复。
- 购物车不提供后端 CRUD，不占用 MySQL 或 Redis。

## 6. Redis 登录方案

采用随机 Token + 简单登录拦截器，不使用 JWT。

### 6.1 登录流程

1. 注册：校验邮箱和密码，密码 BCrypt 哈希后写入 MySQL。
2. 登录：校验密码，生成随机 UUID Token。
3. 写入 Redis：`SET webox:login:{token} {userId} EX 300`。
4. 返回 `{ token, expiresIn: 300, user }`。
5. 前端将 Token 存入 sessionStorage，请求附带 `Authorization: Bearer <token>`。
6. 后端拦截器读取 Redis，取得当前用户 ID；业务接口通过该 ID 识别用户。

### 6.2 到期语义

**5 分钟为登录成功起固定 300 秒，不因访问自动续期。** 这是本文采用的默认解释。

- 刷新页面：sessionStorage 仍保留 Token，调用 `/auth/me` 恢复用户；以 Redis 是否有效为准。
- 到期：下次请求返回 `401`，前端显示 `Your session has expired. Please log in again.` 并跳转登录。
- 退出：删除当前 Redis Key，清理前端 Token。
- Redis 不可用：返回服务不可用错误，不回退为无登录访问。
- 新开独立标签页可能需要重新登录，本期不做跨标签页登录态同步。

不建设复杂安全体系，但订单接口仍以 Token 解析出的用户 ID 为准，查询和取消仅操作本人的订单。

## 7. 数据设计

业务表控制在 5 张。配置和历史快照使用 JSON，减少第一阶段关联表数量。

| 表 | 主要字段 |
| --- | --- |
| `users` | `id`、`email`（唯一）、`password_hash`、`role`、`created_at` |
| `dishes` | `id`、`name`、`description`、`price_fen`、`category`、`image_url`、`proteins_json`、`allergens_json`、`spice_level`、`option_groups_json`、`active` |
| `daily_menu_items` | `id`、`menu_date`、`dish_id`，日期与菜品组合唯一 |
| `orders` | `id`、`order_no`（唯一）、`user_id`、`request_id`、`request_hash`、`delivery_date`、`meal_period`、`address`、`status`、`total_fen`、`created_at` |
| `order_items` | `id`、`order_id`、`dish_id`、`dish_name`、`options_json`、`unit_price_fen`、`quantity`、`subtotal_fen` |

补充约束：

- `orders(user_id, request_id)` 唯一，用于简单防重复提交。
- `orders(user_id, created_at, id)` 索引，用于本人订单列表。
- `order_items(order_id)` 索引及外键；订单与用户、每日菜单与菜品也建立外键。
- 邮箱去掉首尾空格并统一小写后存储；唯一约束处理重复注册。
- 金额使用 `BIGINT` 整数分，数量为正整数。
- `options_json` 保存已选项 ID、英文名称、加价快照，历史订单不依赖当前配置。
- 订单名称、价格、地址均为下单时快照。
- 历史地址从当前用户最近订单中去重提取，最多返回 20 条。

自定义选项示例：

```json
[
  {
    "id": "bun",
    "name": "Bun",
    "minSelect": 1,
    "maxSelect": 1,
    "options": [
      { "id": "plain", "name": "Plain", "extraPriceFen": 0 },
      { "id": "whole-wheat", "name": "Whole Wheat", "extraPriceFen": 0 }
    ]
  }
]
```

菜品配置只通过初始化数据提供，暂不实现 JSON 配置编辑界面。

## 8. API 清单

统一前缀 `/api`。注册和登录公开，其他业务接口要求有效 Token。

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| POST | `/auth/register` | 邮箱注册 |
| POST | `/auth/login` | 登录，返回 Token 和 300 秒有效期 |
| POST | `/auth/logout` | 删除当前登录态 |
| GET | `/auth/me` | 当前用户 |
| GET | `/menu?date=&keyword=&categories=&page=1&pageSize=12` | 每日菜单、搜索、筛选、分页 |
| GET | `/dishes/{id}` | 菜品详情和自定义选项 |
| GET | `/addresses` | 本人历史配送地址 |
| POST | `/orders` | 创建订单 |
| GET | `/orders?page=1&pageSize=10` | 本人订单列表 |
| GET | `/orders/{id}` | 本人订单详情 |
| POST | `/orders/{id}/cancel` | 取消本人 Pending 订单 |

菜单按菜名或描述进行参数化 `LIKE` 查询，转义搜索词中的 `%`、`_`；多个菜系之间为 OR，菜系与关键词之间为 AND。默认日期为服务端当天，业务时区统一 `Asia/Shanghai`，分页采用稳定的 ID 排序。

提交订单示例：

```json
{
  "requestId": "a-client-generated-uuid",
  "deliveryDate": "2026-11-13",
  "mealPeriod": "Lunch",
  "address": "Building A, Floor 3",
  "items": [
    {
      "dishId": 9,
      "quantity": 2,
      "selectedOptions": [
        { "groupId": "bun", "optionId": "whole-wheat" }
      ]
    }
  ]
}
```

后端只接受商品、配置和数量，根据数据库价格计算总价；用户 ID 从登录态取得。

成功响应统一 `{ "data": ... }`；失败响应统一 `{ "code": "...", "message": "English message" }`。HTTP 状态采用 400（参数）、401（未登录/过期）、404（资源不存在或不属于当前用户）、409（重复邮箱/状态冲突/请求键冲突）、503（依赖不可用）等。

## 9. 下单和取消的最小业务保障

### 9.1 创建订单

不增加分布式锁、幂等服务或报价服务，但保留以下简单处理：

1. 前端为当前结算草稿生成并保存 `requestId`，提交时按钮进入 loading；超时重试复用同一 ID。
2. 后端先按当前用户和 `requestId` 查询，已有订单且请求摘要一致时直接返回；不一致返回 409。
3. 校验非空购物车、正整数数量、有效菜品、选项归属与必选要求、配送日期不早于今天、餐次和地址。
4. 第一阶段结算允许选择有供应数据的日期；按所选配送日期检查每日菜单，缺少菜品时返回明确错误，不默认任意日期都可供应。
5. 后端重新计算金额，在一个 `@Transactional` 方法中写入订单和所有明细。
6. 如并发触发唯一键冲突，结束并回滚当前事务，再查询已有订单并比较摘要后返回。
7. 成功后清空本次购物车并进入订单详情页；超时保留草稿和 `requestId`，同一结算未确认成功前修改内容也不轮换 ID；后端摘要冲突返回409，具体生命周期见 [下单幂等方案](order-idempotency.md)。

`request_hash` 由服务端对规范化后的商品、配置、数量和配送信息计算，避免同一个请求 ID 被用于不同订单内容。

本期不设置独立报价确认步骤，最终以服务端返回金额为准。菜单价格在提交前发生变化时，本期不增加二次确认交互。

### 9.2 取消订单

订单初始状态为 `Pending`，员工只能将本人的 `Pending` 改为 `Cancelled`。使用带 `user_id` 和 `status = 'Pending'` 条件的 UPDATE，避免状态被覆盖。重复取消已取消订单返回当前结果；其他状态返回冲突。

保留 `Confirmed`、`Completed` 枚举，本期不提供员工修改这些状态的接口。不提供订单删除功能，历史订单需保留。

## 10. 初始化与启动

实施时提供：

1. `compose.yaml`：独立 MySQL 和 Redis；MySQL 挂载持久化数据卷。
2. `database/schema.sql`：建立 5 张业务表、索引及约束。
3. `database/seed.sql`：PRD 英文菜品、配置、图片路径，以及执行当天和次日的菜单。脚本按当次执行日期生成菜单并可重复执行；跨日演示前补充当天菜单。
4. 后端通过环境变量配置 MySQL、Redis；服务端业务日期使用上海时区。
5. 前端 Vite 开发代理将 `/api` 转发到后端，避免额外配置 CORS 或网关。
6. README 给出依赖版本、启动命令、SQL 初始化、图片复制和验证步骤。

本期默认本地运行：Vite 前端、Spring Boot 后端、MySQL、Redis。生产部署方案留待后续阶段。

## 11. 实施顺序与验收

| 顺序 | 内容 | 验收 |
| --- | --- | --- |
| 1 | MySQL/Redis、表结构、英文种子、素材 | 服务可连接，数据和图片可读 |
| 2 | 注册、登录、前端表单、登录拦截器 | 注册登录可用，刷新保持登录，固定 300 秒过期 |
| 3 | 菜单、详情、搜索筛选、分页 | 能浏览当日菜单和选择配置 |
| 4 | 购物车 | 连续加购、数量修改、删除、金额计算、本地恢复 |
| 5 | 下单、订单列表详情、取消 | 持久化闭环，同请求 ID 不重复创建，仅 Pending 可取消 |
| 6 | 最小测试、README、API 文档 | 从零启动并走通流程 |

最低测试覆盖：重复邮箱、错误密码、Redis TTL/过期、不同配置购物车合并、加料计价、订单主从表事务回滚、重复提交、本人订单过滤、取消状态限制。数据库相关测试使用独立测试 MySQL，登录测试使用测试 Redis；不以 H2 替代实际数据库。

PRD 的完整原始 AI 对话记录要求仍保留，交付时放入 `ai-conversations/` 或在 README 明确原生导出位置，不能用本技术文档代替。
