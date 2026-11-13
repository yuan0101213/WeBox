import { useState } from 'react';
import { Badge, Button, Drawer, message, Space } from 'antd';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { money } from '../types/business';
import CartItems from './CartItems';
export default function Shell() {
  const auth = useAuth(), cart = useCart(), navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return <><header className="header"><div className="header-inner"><Link to="/menu" className="brand">We<span>Box</span></Link>
    <nav><NavLink to="/menu">Menu</NavLink><NavLink to="/orders">My orders</NavLink><NavLink to="/preferences">Preferences</NavLink>{auth.user?.role === 'SUPER_ADMIN' && <NavLink to="/console">Console</NavLink>}</nav>
    <Space wrap><span className="account-email">{auth.user?.email}</span><Badge count={cart.count}><Button onClick={() => setOpen(true)}>Cart</Button></Badge><Button type="text" onClick={() => void auth.logout().catch(() => message.warning('You have been signed out locally.'))}>Log out</Button></Space>
  </div></header><main className="page"><Outlet /></main>
  <Drawer title="Your cart" open={open} onClose={() => setOpen(false)} width={480} footer={<div className="cart-footer"><strong>Total {money(cart.total)}</strong><Button type="primary" disabled={!cart.items.length} onClick={() => { setOpen(false); navigate('/checkout'); }}>Checkout</Button></div>}><CartItems /></Drawer>
  <footer className="footer">WeBox</footer></>;
}
