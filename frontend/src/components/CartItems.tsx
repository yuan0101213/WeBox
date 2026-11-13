import { Button, Empty, InputNumber } from 'antd';
import { useCart } from '../context/CartContext';
import { money } from '../types/business';
export default function CartItems({ editable = true }: { editable?: boolean }) {
  const cart = useCart();
  return cart.items.length ? <div>{cart.items.map(item => <div className="cart-line" key={item.key}>
    <div className="cart-line-content"><strong>{item.dish.name}</strong><small>{item.selectedOptions.map(o => o.name).join(' · ') || 'Standard'}</small><small>{money(item.unitPriceFen)} each</small>
      {editable ? <div className="inline"><InputNumber aria-label={`Quantity for ${item.dish.name}`} min={1} max={Math.max(1, 5 - cart.count + item.quantity)} precision={0} value={item.quantity} onChange={v => v && cart.quantity(item.key, v)} /><Button type="text" danger onClick={() => cart.remove(item.key)}>Remove</Button></div> : <small>Quantity: {item.quantity}</small>}
    </div><strong>{money(item.unitPriceFen * item.quantity)}</strong>
  </div>)}</div> : <Empty description="Your cart is empty" />;
}
