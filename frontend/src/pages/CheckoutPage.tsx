import { useEffect, useRef, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Empty, Form, Input, Select, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, get, post } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { money, today, type Order } from '../types/business';
import CartItems from '../components/CartItems';
import { usePreferences } from '../context/PreferencesContext';
import { useInventory } from '../api/useInventory';
import { prepareCheckoutAttempt } from '../api/checkoutAttempt';
interface Availability { deliveryDate: string; mealPeriod: string; adjusted: boolean; existingOrderId: number | null }
interface Values { deliveryDate: string; mealPeriod: string; address: string }
export default function CheckoutPage() {
  const cart = useCart(), auth = useAuth(), navigate = useNavigate();
  const { preferences } = usePreferences();
  const [availability, setAvailability] = useState<Availability>();
  const [checking, setChecking] = useState(true), [ruleNote, setRuleNote] = useState(''), [revision, setRevision] = useState(0);
  const submitting = useRef(false);
  const key = `webox.checkout.${auth.user!.id}`;
  const [addresses, setAddresses] = useState<string[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [form] = Form.useForm<Values>();
  const [initial] = useState<Values>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}').values || { deliveryDate: sessionStorage.getItem('webox.menuDate') || today(), mealPeriod: 'Lunch', address: '' }; }
    catch { return { deliveryDate: sessionStorage.getItem('webox.menuDate') || today(), mealPeriod: 'Lunch', address: '' }; }
  });
  const selectedDate = Form.useWatch('deliveryDate', form) || initial.deliveryDate;
  const { stocks, loaded: stockLoaded } = useInventory(selectedDate);
  const shortages = cart.items.filter(item => stockLoaded && (!stocks[item.dish.id] || cart.items.filter(other => other.dish.id === item.dish.id).reduce((sum, other) => sum + other.quantity, 0) > stocks[item.dish.id].remainingQuantity));
  const selectedMeal = Form.useWatch('mealPeriod', form) || initial.mealPeriod;
  useEffect(() => {
    let alive = true; setChecking(true);
    get<Availability>('/checkout/availability', { deliveryDate: selectedDate, mealPeriod: selectedMeal }).then(result => {
      if (!alive) return;
      setAvailability(result);
      if (result.adjusted) {
        form.setFieldsValue({ deliveryDate: result.deliveryDate, mealPeriod: result.mealPeriod });
        setRuleNote(`The cutoff has passed. Your order has been switched to ${result.deliveryDate} ${result.mealPeriod}.`);
      }
    }).catch(err => { if (alive) { setAvailability(undefined); setError(errorMessage(err)); } }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [selectedDate, selectedMeal, form, revision]);
  useEffect(() => { get<string[]>('/addresses').then(setAddresses).catch(() => {}); }, []);
  function draft(values: Values) {
    const items = cart.items.map(i => ({ dishId: i.dish.id, quantity: i.quantity, selectedOptions: i.selectedOptions.map(o => ({ groupId: o.groupId, optionId: o.optionId })) }));
    return prepareCheckoutAttempt(key, values, items);
  }
  async function submit(values: Values) {
    if (submitting.current || loading || checking || !availability || cart.count > 5 || shortages.length) return;
    submitting.current = true;
    setLoading(true); setError('');
    try {
      const order = await post<Order>('/orders', draft(values));
      localStorage.removeItem(key);
      if (order.status !== 'Cancelled') cart.clear();
      navigate(`/orders/${order.id}`, { replace: true, state: { success: order.status !== 'Cancelled', replayedCancelled: order.status === 'Cancelled' } });
    } catch (err) { submitting.current = false; setLoading(false); setError(errorMessage(err)); setRevision(value => value + 1); }
  }
  if (!cart.items.length) return <Card><Empty description="Your cart is empty"><Link to="/menu"><Button type="primary">Browse menu</Button></Link></Empty></Card>;
  return <><Link to="/menu">← Back to menu</Link><Typography.Title level={2}>Checkout</Typography.Title><div className="checkout-grid"><Card title="Your meal"><CartItems /><div className="total-line">Total <strong>{money(cart.total)}</strong></div><p className="muted">The final price is calculated by the server when you place your order.</p></Card>
    <Card title="Delivery details">{shortages.length > 0 && <Alert className="spaced" type="error" message={`Insufficient stock: ${[...new Set(shortages.map(i => i.dish.name))].join(', ')}. Reduce quantities or remove these dishes before trying again.`} />}{ruleNote && <Alert className="spaced" type="info" message={ruleNote} />}{cart.count > 5 && <Alert className="spaced" type="error" message="An order can contain at most 5 meals. Reduce the quantities in your cart." />}{cart.total > preferences.budgetMaxFen && <Alert className="spaced" type="warning" message={`Your total is above your budget of ${money(preferences.budgetMaxFen)}. You can still place this order.`} />}{error && <Alert className="spaced" type="error" message={error} />}<Form form={form} layout="vertical" initialValues={initial} onValuesChange={(_, values) => { setRuleNote(''); draft(values); }} onFinish={submit} requiredMark={false} disabled={loading}>
      <Form.Item name="deliveryDate" label="Delivery date" rules={[{ required: true, message: 'Choose a delivery date.' }]}><Input type="date" min={today()} /></Form.Item>
      <Form.Item name="mealPeriod" label="Meal period" rules={[{ required: true }]}><Select options={[{ value: 'Lunch', label: 'Lunch' }, { value: 'Dinner', label: 'Dinner' }]} /></Form.Item>
      <Form.Item name="address" label="Delivery address" rules={[{ required: true, whitespace: true, message: 'Enter a delivery address.' }, { max: 200 }]}><AutoComplete options={addresses.map(value => ({ value }))} filterOption={(input, option) => (option?.value || '').toLowerCase().includes(input.toLowerCase())}><Input maxLength={200} placeholder="Building, floor and room" /></AutoComplete></Form.Item>
      <p className="muted">Selected dishes must be available on your delivery date.</p>{availability?.existingOrderId ? <Button type="primary" block onClick={() => { localStorage.removeItem(key); navigate(`/orders/${availability.existingOrderId}`); }}>View Existing Order</Button> : <Button type="primary" block htmlType="submit" disabled={loading || checking || !availability || cart.count > 5 || shortages.length > 0} loading={loading || checking}>Place order · {money(cart.total)}</Button>}
    </Form></Card></div></>;
}
