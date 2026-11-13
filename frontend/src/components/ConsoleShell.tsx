import { Button, Space, Spin, message } from 'antd';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ConsoleShell() {
  const auth = useAuth();
  if (auth.loading) return <Spin />;
  if (!auth.user || auth.user.role !== 'SUPER_ADMIN') return <Navigate to="/menu" replace />;
  return <><header className="header"><div className="header-inner"><Link className="brand" to="/console">WeBox Console</Link><nav><Link to="/console">Dishes & daily menu</Link><Link to="/menu">Employee menu</Link></nav><Space><span>{auth.user.email}</span><Button onClick={() => void auth.logout().catch(() => message.warning('You have been signed out locally.'))}>Log out</Button></Space></div></header><main className="page"><Outlet /></main></>;
}
