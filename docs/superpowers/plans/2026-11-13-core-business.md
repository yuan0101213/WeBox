# WeBox Core Business Implementation Plan

**Goal:** 按已批准的简化技术方案完成核心业务并运行展示。
**Spec:** docs/phase-1-technical-design.md
**Execution:** 当前会话直接实施；无 Git 仓库，原地工作。

## Tasks
- [x] 后端：注册登录（Redis 固定 300 秒）、菜单搜索筛选详情、地址历史、订单创建/查询/取消。
- [x] 核心测试：配置校验与加价、后端构建；真实 MySQL/Redis HTTP 测试注册、失效、幂等、越权与取消。
- [x] 前端：登录注册、菜单卡片与详情、购物车本地持久化、结算、订单列表详情。
- [x] 运行：重新启动后端和前端，验证代理，浏览器展示。
- [x] 更新 README/API 文档，记录验证结果。

## Constraints
- React 基础组件，SPA 直连 JDK17 Spring Boot，独立 MySQL、Redis。
- 全部用户内容英文；不增加网关、Spring Security、支付或库存功能。
- 计价整数分、订单快照、事务和用户范围校验；固定 300 秒登录态。
- 网络重试复用 requestId，订单内容变化后生成新 ID。
