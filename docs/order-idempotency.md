# 下单幂等与连续点击技术方案

## 1. 结论与目标

前端携带唯一提交 ID、后端通过数据库唯一约束实现幂等，可以解决用户连续点击、网络重试、响应丢失导致的重复下单。数据库主键或唯一索引均可承担约束；本项目保留 `orders.id` 自增主键，以已有的 `(user_id, request_id)` 唯一索引作为提交幂等约束，无需更换主键或另建幂等表。

同一提交最终最多创建一个订单、扣减一次库存；重复成功请求返回同一个订单 ID，而不是仅提示“重复请求”。按钮 loading 和前端同步锁减少重复网络请求，数据库约束是最终保障。

## 2. 提交 ID 的生命周期

1. 当前用户进入结算并产生草稿时生成 `crypto.randomUUID()`，请求字段名为 `requestId`。
2. 草稿以 `webox.checkout.<userId>` 为键存入 localStorage。连续点击、超时重试、刷新页面继续使用同一个 ID。
3. 在当前结算尚未确认成功时，修改表单也不轮换 ID。特别是“服务器已创建订单但响应丢失”后，改变地址再提交不能悄悄生成第二个订单。
4. 请求正文会规范化地址首尾空格、选项和商品排序，以减少无实质差异的请求。
5. 收到成功响应后，清理已提交购物车和草稿并跳转订单详情。当前组件的同步提交锁继续保持成功状态，直到卸载，防止成功后跳转尚未完成时再次提交。
6. 点击 `View Existing Order` 结束当前提交意图并清理该草稿 ID，购物车仍保留；查看并取消原订单后再次结算会生成新 ID。迟到重放若返回 `Cancelled`，前端展示取消结果并保留购物车，不误报新单成功。
7. 如果请求失败，释放同步锁，但保留草稿 ID；只要仍是该结算草稿，不主动生成新 ID。真正的新结算在上一笔确认完成并清理草稿后生成新 ID。

## 3. 前端实现

`frontend/src/api/checkoutAttempt.ts` 负责规范化请求及草稿 ID 持久化。`CheckoutPage.tsx` 使用 `useRef` 同步锁：

```text
表单提交
  → 同步检查并设置 submitting.current
  → 设置按钮 loading/disabled
  → 读取或创建当前草稿 requestId
  → POST /api/orders
  → 成功：清理草稿、保持锁、跳转
  → 失败：释放锁、保留 ID，查询当前餐次已有订单
```

`useState` 更新不是同步锁；同一个 JavaScript 任务内连续触发表单提交时，不能只依赖上一轮渲染中的 `loading` 值。前端锁也不能替代后端幂等，因为客户端可能刷新、多标签页或直接重试 HTTP。

## 4. 数据库和后端实现

现有表结构：

```sql
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
request_id VARCHAR(36) NOT NULL,
request_hash CHAR(64) NOT NULL,
UNIQUE KEY uk_orders_user_request (user_id, request_id)
```

- `user_id` 从登录态取得，客户端不能替别人指定身份。
- `requestId` 标识一次结算，`request_hash` 是后端计算的规范化业务请求 SHA-256，不相信前端摘要。
- 不以“先查询再插入”作为唯一保障：并发请求都可能查询不到，必须保留数据库唯一索引。

`OrderService.create` 当前执行顺序：

1. 按用户和 requestId 查询已有订单；有记录则比较请求摘要。
2. 相同 ID、相同内容：返回原订单详情。不同内容：返回 `409 REQUEST_ID_REUSED`，不创建新单。
3. 新请求校验数量、配送餐次、菜单、配置与金额。
4. 同一事务内插入订单主表（触发唯一约束），再按菜品 ID 顺序条件扣减库存，最后写明细。
5. 如发生唯一键冲突，当前事务退出并回滚；在事务外重查用户/requestId。相同摘要返回已成功订单，不重复扣减；不存在该提交但有餐次冲突则返回 `409 EXISTING_ORDER`。
6. 库存不足或明细失败时整个事务回滚，不留下占用幂等键的半成品订单。原 ID 可以在修正条件后继续重试，直到成功创建。

先插入唯一约束记录、再扣库存，避免多个相同请求争抢最后一份时，后到的重复请求被误报库存不足。

两个约束承担不同职责：

| 约束 | 目的 |
| --- | --- |
| `(user_id, request_id)` 唯一 | 同一次提交至多一单，包括原订单取消后的迟到重放 |
| `(user_id, delivery_date, meal_period, active_slot)` 唯一 | 不同提交 ID 也不能违反同餐次仅一个有效订单的业务规则 |

已取消订单的原 requestId 仍保留。迟到重试返回原 `Cancelled` 订单，不产生新单；用户真正重新下单需要一个新结算 ID。幂等记录与订单同生命周期，不通过几分钟的缓存过期清掉，因此服务重启或 Redis 重启不会丢失提交去重能力。

## 5. 请求示例与错误恢复

```json
{
  "requestId": "11111111-1111-4111-8111-111111111111",
  "deliveryDate": "2026-11-14",
  "mealPeriod": "Lunch",
  "address": "Office A",
  "items": [{"dishId": 1, "quantity": 1, "selectedOptions": []}]
}
```

网络超时不能直接认定订单未创建，不应换 UUID 重新发送。沿用原 ID 和原正文重试，或点击 `View Existing Order` 查看已有订单。若修改内容后出现 `REQUEST_ID_REUSED`，应先查看原订单；需要变更时按业务规则取消原单，再开始新的结算。

## 6. 验证

```sh
cd frontend
npm run test:unit
npx playwright test e2e/idempotency.spec.ts
cd ..
python3 scripts/verify-idempotency.py
```

测试覆盖：

- 连续10次准备同一草稿、刷新恢复、地址空格与选项顺序变化均复用 ID。
- 同一结算中修改内容不自动轮换 ID；其他用户使用独立草稿。
- 同一 JavaScript 任务内触发6次表单提交，延迟响应期间只发送1次 HTTP 下单请求。
- 6个相同ID请求并发返回同一个订单，只扣1份库存。
- 同ID不同正文返回409；取消后的迟到重放不再次扣减。
- 取消后只有显式的新ID才能创建新订单。

API 脚本使用真实 MySQL/Redis 和单独未来日期，结束时取消测试订单并清理测试菜单。测试账号与下架的测试菜品会保留。
