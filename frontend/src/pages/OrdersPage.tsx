import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Pagination, Spin, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { get, errorMessage } from '../api/client';
import { money, type Order, type Page } from '../types/business';
export const statusColor = (status: string) => ({ Pending: 'gold', Confirmed: 'blue', Completed: 'green', Cancelled: 'default' })[status];
export default function OrdersPage() {
  const [page, setPage] = useState(1), [result, setResult] = useState<Page<Order>>({ items: [], total: 0 }), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    get<Page<Order>>('/orders', { page, pageSize: 10 }).then(r => { if (alive) setResult(r); }).catch(e => { if (alive) setError(errorMessage(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page]);
  return <><Typography.Title level={2}>My orders</Typography.Title><p className="muted">Your meals, past and upcoming.</p>{error && <Alert type="error" message={error} />}<Spin spinning={loading}><div className="order-list">{result.items.map(order => <Card key={order.id}><div className="order-row"><div><Tag color={statusColor(order.status)}>{order.status}</Tag><h3>{order.deliveryDate} · {order.mealPeriod}</h3><p>{order.address}</p><small className="muted order-number">{order.orderNo}</small></div><div className="order-actions"><strong>{money(order.totalFen)}</strong><Link to={`/orders/${order.id}`}><Button>View details</Button></Link></div></div></Card>)}</div>{!loading && !error && !result.items.length && <Empty description="No orders yet"><Link to="/menu"><Button type="primary">Find your first meal</Button></Link></Empty>}</Spin>{result.total > 10 && <Pagination className="pagination" current={page} pageSize={10} total={result.total} showSizeChanger={false} onChange={setPage} />}</>;
}
