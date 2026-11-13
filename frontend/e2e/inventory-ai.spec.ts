import { test, expect } from '@playwright/test';

test('stock updates another browser without refresh, and AI shows real streamed cards', async ({ browser, request }) => {
  test.setTimeout(120000);
  const adminResult = await request.post('/api/auth/login', { data: { email: 'superadmin@webox.test', password: 'WeBoxAdmin123' } });
  const admin = (await adminResult.json()).data.token;
  const headers = { Authorization: `Bearer ${admin}` };
  const stamp = Date.now();
  const dateValue = new Date(); dateValue.setDate(dateValue.getDate() + 46);
  const date = dateValue.toISOString().slice(0, 10);
  const dishResult = await request.post('/api/console/dishes', { headers, data: { name: `Fresh Bowl ${stamp}`, description: 'Light chicken and vegetable bowl', priceFen: 2200, category: 'Light Meal', imageUrl: '', proteins: ['Chicken'], allergens: [], spiceLevel: 'None', optionGroups: [], active: true } });
  expect(dishResult.status()).toBe(200);
  const dish = (await dishResult.json()).data;
  expect((await request.put('/api/console/menu', { headers, data: { date, items: [{ dishId: dish.id, supplyQuantity: 2 }] } })).status()).toBe(200);
  const contexts = [];
  const tokens: string[] = [];
  for (let i = 0; i < 2; i++) {
    const credentials = { email: `live-${stamp}-${i}@example.test`, password: 'TestPass123' };
    await request.post('/api/auth/register', { data: credentials });
    const result = await request.post('/api/auth/login', { data: credentials });
    const token = (await result.json()).data.token;
    tokens.push(token);
    const context = await browser.newContext();
    await context.addInitScript(({ token, date }) => { sessionStorage.setItem('webox.token', token); sessionStorage.setItem('webox.menuDate', date); }, { token, date });
    contexts.push(context);
  }
  const first = await contexts[0].newPage(), second = await contexts[1].newPage();
  await Promise.all([first.goto('http://127.0.0.1:5173/menu'), second.goto('http://127.0.0.1:5173/menu')]);
  await expect(second.locator('.dish-card')).toContainText('2 remaining');
  // Real DeepSeek call; cards appear incrementally from the server, not a fixture.
  await first.getByLabel('What would you like to eat?').fill('Recommend one dish from this menu. Give one brief reason.');
  await first.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(first.getByRole('status')).toContainText('Recommendations ready.', { timeout: 60000 });
  await expect(first.locator('.ant-card-small')).toContainText(dish.name);
  await first.screenshot({ path: '../docs/screenshots/ai-recommendations.png', fullPage: true });
  const body = { requestId: crypto.randomUUID(), deliveryDate: date, mealPeriod: 'Lunch', address: 'Live stock test office', items: [{ dishId: dish.id, quantity: 2, selectedOptions: [] }] };
  const orderResult = await request.post('/api/orders', { headers: { Authorization: `Bearer ${tokens[0]}` }, data: body });
  expect(orderResult.status()).toBe(200);
  const order = (await orderResult.json()).data;
  await expect(second.locator('.dish-card')).toContainText('Sold out', { timeout: 10000 });
  await expect(second.locator('.dish-card').getByRole('button', { name: 'Sold out' })).toBeDisabled();
  await second.screenshot({ path: '../docs/screenshots/stock-sold-out.png', fullPage: true });
  await request.post(`/api/orders/${order.id}/cancel`, { headers: { Authorization: `Bearer ${tokens[0]}` } });
  await expect(second.locator('.dish-card')).toContainText('2 remaining', { timeout: 10000 });
  await request.put('/api/console/menu', { headers, data: { date, items: [] } });
  await request.patch(`/api/console/dishes/${dish.id}/status`, { headers, data: { active: false } });
  await Promise.all(contexts.map(context => context.close()));
});
