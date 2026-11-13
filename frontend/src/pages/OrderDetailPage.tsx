import { useEffect, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Spin, Tag, Typography, message } from 'antd';
import { Link, useLocation, useParams } from 'react-router-dom';
import { errorMessage, get, post } from '../api/client';
import { money, type Order } from '../types/business';
import { statusColor } from './OrdersPage';
export default function OrderDetailPage() {
  const { id } = useParams(), location = useLocation();
  const [order, setOrder] = useState<Order>(), [error, setError] = useState(''), [loading, setLoading] = useState(true), [cancelling, setCancelling] = useState(false);
  useEffect(() => { let alive = true; setLoading(true); get<Order>(`/orders/${id}`).then(o => { if (alive) setOrder(o); }).catch(e => { if (alive) setError(errorMessage(e)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [id]);
  async function cancel() {
    setCancelling(true);
    try { setOrder(await post<Order>(`/orders/${id}/cancel`)); message.success('Order cancelled.'); }
    catch (err) { setError(errorMessage(err)); } finally { setCancelling(false); }
  }
  return <><Link to="/orders">← My orders</Link><Typography.Title level={2}>Order details</Typography.Title>{location.state?.success && <Alert className="spaced" type="success" showIcon message="Your order has been placed!" description="Your delivery details are shown below." />}{error && <Alert className="spaced" type="error" message={error} />}<Spin spinning={loading}>{order && <><Card className="spaced"><div className="order-row"><div><Tag color={statusColor(order.status)}>{order.status}</Tag><h3>{order.deliveryDate} · {order.mealPeriod}</h3><p>Delivery to: {order.address}</p><small className="muted order-number">{order.orderNo}</small></div>{order.status === 'Pending' && <Popconfirm title="Cancel this order?" description="This action cannot be undone." onConfirm={cancel} okText="Cancel order" cancelText="Keep order"><Button danger loading={cancelling}>Cancel order</Button></Popconfirm>}</div></Card><Card title="Order items">{order.items?.map(item => <div className="order-item" key={item.id}><div><strong>{item.dishName}</strong><small>{item.options.map(o => o.name).join(' · ') || 'Standard'}</small><small>{money(item.unitPriceFen)} × {item.quantity}</small></div><strong>{money(item.subtotalFen)}</strong></div>)}<div className="total-line">Total <strong>{money(order.totalFen)}</strong></div></Card></>}</Spin></>;
}
