import '@ant-design/v5-patch-for-react-19';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import enUS from 'antd/locale/en_US';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Shell from './components/Shell';
import AuthPage from './pages/AuthPage';
import MenuPage from './pages/MenuPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import PreferencesPage from './pages/PreferencesPage';
import { PreferencesProvider } from './context/PreferencesContext';
import ConsoleShell from './components/ConsoleShell';
import ConsolePage from './pages/ConsolePage';
import './style.css';
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><Spin size="large" /></div>;
  return user ? <PreferencesProvider key={user.id}><CartProvider><Outlet /></CartProvider></PreferencesProvider> : <Navigate to="/login" replace />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ConfigProvider locale={enUS} theme={{ token: { colorPrimary: '#18764d', borderRadius: 10, fontFamily: 'Inter, system-ui, sans-serif' } }}>
    <BrowserRouter><AuthProvider><Routes>
      <Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage register />} />
      <Route element={<Protected />}><Route element={<Shell />}>
        <Route path="/menu" element={<MenuPage />} /><Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/preferences" element={<PreferencesPage />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/orders/:id" element={<OrderDetailPage />} />
      </Route><Route path="/console" element={<ConsoleShell />}><Route index element={<ConsolePage />} /></Route></Route><Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes></AuthProvider></BrowserRouter>
  </ConfigProvider></React.StrictMode>,
);
