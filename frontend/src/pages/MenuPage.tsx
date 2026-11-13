import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Pagination, Select, Spin, Tag, Typography, Switch, message } from 'antd';
import axios from 'axios';
import { api, errorMessage, get } from '../api/client';
import { useCart } from '../context/CartContext';
import type { Dish, Page } from '../types/business';
import { money, today } from '../types/business';
import DishModal from '../components/DishModal';
import DishPhoto from '../components/DishPhoto';
import AiAssistant from '../components/AiAssistant';
import { useInventory } from '../api/useInventory';
import { usePreferences } from '../context/PreferencesContext';
const categories = ['Chinese', 'Western', 'Japanese', 'Light Meal', 'Korean', 'Southeast Asian'];
export default function MenuPage() {
  const cart = useCart();
  const { preferences, loaded, error: preferenceError, retry } = usePreferences();
  const [recommend, setRecommend] = useState(false);
  const [keyword, setKeyword] = useState(''), [selected, setSelected] = useState<string[]>([]), [date, setDate] = useState(() => sessionStorage.getItem('webox.menuDate') || today());
  const { stocks, error: stockError, loaded: stockLoaded } = useInventory(date);
  const stockIds = Object.keys(stocks).sort().join(',');
  const [page, setPage] = useState(1), [result, setResult] = useState<Page<Dish>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [detail, setDetail] = useState<Dish | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try { const response = await api.get('/menu', { params: { keyword, categories: selected.join(','), date, recommend, page, pageSize: 12 }, signal: controller.signal }); setResult(response.data.data); }
      catch (err) { if (!axios.isCancel(err)) setError(errorMessage(err)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [keyword, selected, date, page, recommend, preferences, stockIds]);
  async function details(dish: Dish) {
    try { const value = await get<Dish>(`/dishes/${dish.id}`); setDetail({ ...value, menuDate: date, remainingQuantity: stocks[dish.id]?.remainingQuantity ?? (stockLoaded ? 0 : dish.remainingQuantity), supplyQuantity: stocks[dish.id]?.supplyQuantity ?? dish.supplyQuantity }); } catch (err) { message.error(errorMessage(err)); }
  }
  return <><div className="page-heading"><div><Typography.Title level={2}>Daily menu</Typography.Title><p className="muted">Search dishes, choose your options and add to cart.</p></div><label className="date-picker">Menu date<input aria-label="Menu date" type="date" value={date} min={today()} onChange={e => { if (e.target.value) { setDate(e.target.value); sessionStorage.setItem('webox.menuDate', e.target.value); setPage(1); } }} /></label></div>
    <AiAssistant date={date} />
    <div className="menu-tools"><Input.Search aria-label="Search dishes" placeholder="Search dishes or ingredients" maxLength={50} allowClear value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} /><Select mode="multiple" aria-label="Filter cuisines" placeholder="All cuisines" value={selected} options={categories.map(c => ({ value: c, label: c }))} onChange={v => { setSelected(v); setPage(1); }} allowClear /></div>
    <p><Switch disabled={!loaded} checked={recommend} onChange={value => { setRecommend(value); setPage(1); }} /> Recommend for me</p>
    {preferenceError && <Alert className="spaced" type="error" message="Your preferences could not be loaded. Retry before adding a meal." action={<Button onClick={retry}>Retry</Button>} />}
    {cart.count >= 5 && <Alert className="spaced" type="info" message="Maximum 5 meals per order. Remove a meal to add another." />}
    {stockError && <Alert className="spaced" type="warning" message="Live stock is temporarily unavailable. Availability will be checked when you place your order." />}
    {error && <Alert className="spaced" type="error" message={error} />}
    <Spin spinning={loading}><div className="menu-meta">{result.total} dishes available <span>Prices in CNY</span></div><div className="dish-grid">{result.items.map(original => { const stock = stocks[original.id]; const dish = { ...original, menuDate: date, remainingQuantity: stock?.remainingQuantity ?? (stockLoaded ? 0 : original.remainingQuantity), supplyQuantity: stock?.supplyQuantity ?? original.supplyQuantity }; return <Card className="dish-card" key={dish.id}>
      <DishPhoto dish={dish} /><Tag>{dish.category}</Tag>{recommend && (preferences.cuisines.includes(dish.category) || preferences.spiceLevel === dish.spiceLevel) && <Tag color="green">Matches your preferences</Tag>}<h3><button onClick={() => void details(dish)}>{dish.name}</button></h3><p className="dish-description">{dish.description}</p><div className="stock-label">{dish.remainingQuantity !== undefined && <Tag color={dish.remainingQuantity === 0 ? 'default' : dish.remainingQuantity <= 3 ? 'orange' : undefined}>{dish.remainingQuantity === 0 ? 'Sold out' : `${dish.remainingQuantity} remaining`}</Tag>}</div><div className="dish-bottom"><strong>{money(dish.priceFen)}</strong><Button type="primary" disabled={!loaded || cart.count >= 5 || dish.remainingQuantity === 0} onClick={() => { if (dish.optionGroups.length) void details(dish); else { cart.add(dish, []); } }}>{dish.remainingQuantity === 0 ? 'Sold out' : dish.optionGroups.length ? 'Customize' : 'Add to cart'}</Button></div>
    </Card>; })}</div>{!loading && !error && !result.items.length && <Empty description="No dishes found. Try another search or date." />}</Spin>
    {result.total > 12 && <Pagination className="pagination" current={page} total={result.total} pageSize={12} showSizeChanger={false} onChange={setPage} />}
    <DishModal dish={detail ? { ...detail, remainingQuantity: stocks[detail.id]?.remainingQuantity ?? (stockLoaded ? 0 : detail.remainingQuantity) } : null} onClose={() => setDetail(null)} />
  </>;
}
