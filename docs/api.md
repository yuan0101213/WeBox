# WeBox Core API

Base URL: `/api`. Success: `{ "data": ... }`; error: `{ "code": "...", "message": "English message" }`.

All endpoints except `/health`, `/auth/register`, `/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Request / response |
| --- | --- | --- |
| GET | `/health` | MySQL/Redis status; dependency failure returns 503 |
| POST | `/auth/register` | `{email,password}` → `{id,email,role}`; duplicate email 409 |
| POST | `/auth/login` | `{email,password}` → `{token,expiresIn:300,user}` |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Delete current Redis session |
| GET | `/menu` | Query: `date` (Shanghai today), `keyword` (≤50), `categories` (comma-separated), `page` (1+), `pageSize` (1–50); returns `{items,total,page,pageSize,date}` |
| GET | `/dishes/{id}` | Active dish with `optionGroups` |
| GET | `/addresses` | Up to 20 distinct addresses from current user's orders |
| POST | `/orders` | Request below → full order including item snapshots |
| GET | `/orders` | `page`, `pageSize` → `{items,total}`, newest first |
| GET | `/orders/{id}` | Current user's order with item snapshots; other users get 404 |
| POST | `/orders/{id}/cancel` | Pending → Cancelled; repeated cancellation succeeds; other states 409 |

## Create order

```json
{
  "requestId": "95f8503b-55db-4396-ab9d-2b521f5e8dac",
  "deliveryDate": "2026-11-13",
  "mealPeriod": "Lunch",
  "address": "Building A, Floor 3",
  "items": [
    {
      "dishId": 9,
      "quantity": 2,
      "selectedOptions": [
        {"groupId":"bun","optionId":"whole-wheat"},
        {"groupId":"sauce","optionId":"mustard"},
        {"groupId":"add-ons","optionId":"cheese"}
      ]
    }
  ]
}
```

Date must not be in the past, and dishes must be on the menu for that date. Quantity is 1–5 per line; at most 100 lines. Required options, option membership and group limits are checked server-side.

All money fields use integer CNY fen. The request supplies no trusted prices; server loads prices from MySQL. Example above costs 8200 fen (¥82.00). Final server price is displayed on the order details page.

`requestId` stays the same for retries of the same submission. Same user + same ID + same normalized contents returns the existing order; changed contents with that ID returns 409. Creation and item snapshots are in one transaction.

Sessions expire exactly 300 seconds after login, without sliding renewal. Refresh does not reset TTL. Expired/missing token returns 401. Registration requires email ≤200 characters, password 8–64 characters containing letters and digits and no more than 72 UTF-8 bytes. Stored passwords use BCrypt.

## Error examples

```json
{"code":"EMAIL_ALREADY_REGISTERED","message":"This email is already registered."}
```

Other common codes: `INVALID_INPUT` (400), `INVALID_CREDENTIALS` (401), `SESSION_EXPIRED` (401), `NOT_FOUND` (404), `REQUEST_ID_REUSED` (409), `ORDER_NOT_CANCELLABLE` (409), `SERVICE_UNAVAILABLE` (503).

## Phase 2

- `GET/PUT /preferences`: `{allergens,cuisines,spiceLevel,taste,budgetMinFen,budgetMaxFen}`. Allergens use the seven PRD enums; taste is `Light/Moderate/Strong`. Maximum budget must be at least minimum budget.
- `GET /menu?recommend=true`: prioritize preferred cuisines, then matching spice before pagination. Allergen dishes remain visible.
- `GET /checkout/availability?deliveryDate=YYYY-MM-DD&mealPeriod=Lunch`: `{deliveryDate,mealPeriod,adjusted,existingOrderId}`. Shanghai cutoffs are 10:00 and 15:00; equality means closed. Returns nearest available slot and current user's active order if any.
- `POST /orders`: total quantity now limited to **5 servings**. Server applies cutoff switching and enforces one Pending/Confirmed order per user/date/meal. A different request ID targeting an existing active order returns `409 EXISTING_ORDER`; cancellation frees the slot.

All `/console/**` APIs require **SUPER_ADMIN**. EMPLOYEE and ADMIN get 403; role is verified server-side on every request.

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/console/dishes` | `keyword,categories,page,pageSize`; all active/inactive dishes, `{items,total}` |
| POST | `/console/dishes` | Dish fields → saved dish |
| PUT | `/console/dishes/{id}` | Dish fields → saved dish |
| PATCH | `/console/dishes/{id}/status` | `{active:boolean}` |
| GET | `/console/menu?date=...` | `[{dishId,supplyQuantity}]` |
| PUT | `/console/menu` | `{date,items:[{dishId,supplyQuantity}]}` replaces specified date atomically |
| POST | `/console/images` | Multipart `file` JPEG/PNG/WebP ≤5MB → `{url}`; file served at `/uploads/...` |

Dish fields: `{name,description,priceFen,category,imageUrl,proteins,allergens,spiceLevel,optionGroups,active}`. Daily supply configuration does not deduct inventory in phase2.

## Inventory and AI

- `GET /inventory?date=YYYY-MM-DD` → `{date,items:[{dishId,remainingQuantity,supplyQuantity}]}`, from Redis date snapshot. Page polls every2 seconds.
- Menu items include `remainingQuantity` / `supplyQuantity`; zero is sold out, 1–3 low stock.
- Order placement atomically deducts aggregated dish quantities. `409 INSUFFICIENT_STOCK` names the dish; no partial order survives. Pending cancellation restores once.
- Console quantity edits cannot reduce below consumed quantity or remove dishes with un-cancelled consumption (`409 STOCK_CONFLICT`).
- `POST /recommendations` body `{prompt,date}`; authenticated SSE events `status`, `recommendation` (`{dish,reason}`), `done`, `error`. This is an actual DeepSeek model request, not a local fallback. Frontend uses streaming fetch with bearer Token.
- Cached snapshots are eventually consistent; database conditions guarantee no oversell.
