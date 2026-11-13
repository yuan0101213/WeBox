# WeBox Project Bootstrap Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks in this session.

**Goal:** 创建可构建的前后端骨架，初始化独立 MySQL 的五张业务表及英文演示数据。
**Architecture:** React SPA 调用 Spring Boot；MySQL 持久化，Redis 预留固定 300 秒登录态配置。
**Tech Stack:** React、TypeScript、Vite、Ant Design、JDK 17、Spring Boot 3.5、Spring JDBC、MySQL、Redis。
**Spec:** docs/phase-1-technical-design.md

## Global Constraints
- 本次只初始化工程与数据库，不将骨架描述为已完成业务功能。
- 不添加网关或 Spring Security；不使用内存数据库替代 MySQL。
- 用户界面英文，素材使用 product_images。
- 不修改已有 MySQL/Redis 容器，项目服务使用 13306/16379 独立端口。

## Review Focus
- 本机已有服务不能被覆盖或停止。
- SQL 重复执行不删除业务数据，种子数据不重复。
- 数据库金额、数量和外键约束有效。
- 依赖不可用不能显示服务正常。
- 初始化脚本使用项目自己的 Compose 服务。

## Task 1: 基础设施与数据库
- [x] 创建 compose.yaml、.env.example、database/schema.sql、seed.sql 和 scripts/init-db.sh。
- [x] 启动项目专属 MySQL/Redis，运行初始化脚本。
- [x] 查询五张表与种子数据，重复初始化检查数量稳定；验证约束拒绝无效数据。

## Task 2: 后端骨架
- [x] 创建 Maven 工程、JDK 17 配置、数据源及 Redis 配置。
- [x] 创建 /api/health 及测试；健康检查实际访问 SELECT 1 和 Redis PING。
- [x] 编译并测试，使用 JDK 17 启动验证接口。

## Task 3: 前端与交付
- [x] 创建 React/TypeScript/Vite 工程、基础首页、Axios、API 代理及图片素材。
- [x] 安装依赖并执行 TypeScript/Vite 构建。
- [x] 通过开发代理验证前后端联通，编写 README 和初始化记录。

## Execution Notes
- 当前目录没有 Git 仓库，因此原地创建工程，不创建 worktree 或自动提交。
- 用户已明确要求按方案执行，直接完成上述任务，无额外审批步骤。

## Verification Record
- 2026-11-13：`./scripts/init-db.sh` 执行两次均成功；5 张表，9 个菜品，2026-11-13/14 各 9 个菜单条目。
- `python3 scripts/verify-db.py`：表、唯一键、外键、金额、数量及事务回滚检查全部通过。
- JDK 17 Maven package：3 tests, 0 failures/errors，生成可执行 JAR。
- Node 22 `npm run build`：TypeScript 与 Vite 通过；有单文件包体积 >500kB 的非阻断提醒，第一阶段暂不进行构建拆包优化。
- HTTP：后端 `/api/health` 与前端 `/api/health` 代理均返回三个 UP，首页及图片返回 200。
- 环境说明：本机默认 Homebrew Node 25 缺少动态库，验证时显式使用现有 Node 22，未修改系统安装。
- 尚未实现：认证业务、菜单查询、购物车和订单 CRUD；300 秒 TTL 目前仅为配置。
- Maven Wrapper 实测：`JAVA_HOME=<JDK17> ./mvnw test`，3 tests, 0 failures/errors，BUILD SUCCESS。
