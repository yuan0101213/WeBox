import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { post, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types/business';
export default function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth(), navigate = useNavigate();
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  if (auth.user) return <Navigate to={auth.user.role === 'SUPER_ADMIN' ? '/console' : '/menu'} replace />;
  async function submit(values: { email: string; password: string }) {
    setLoading(true); setError('');
    try {
      if (register) { await post('/auth/register', values); message.success('Account created. Please log in.'); navigate('/login'); }
      else {
        const result = await post<{ token: string; user: User }>('/auth/login', values);
        auth.login(result.token, result.user); navigate(result.user.role === 'SUPER_ADMIN' ? '/console' : '/menu');
      }
    } catch (err) { setError(errorMessage(err)); } finally { setLoading(false); }
  }
  return <div className="auth-page"><Link className="brand" to="/">We<span>Box</span></Link><Typography.Title level={2}>{register ? 'Create your account' : 'Welcome back'}</Typography.Title><p className="muted">Employee meal ordering</p>
    <Card>{auth.expired && <Alert className="spaced" type="warning" message="Your session has expired. Please log in again." />}{error && <Alert className="spaced" type="error" message={error} />}
    <Form layout="vertical" onFinish={submit} requiredMark={false} key={register ? 'register' : 'login'}>
      <Form.Item name="email" label="Work email" rules={[{ required: true, message: 'Please enter your email.' }, { type: 'email', message: 'Please enter a valid email.' }, { max: 200 }]} normalize={v => v.trim()}><Input maxLength={200} autoComplete="email" placeholder="you@company.com" /></Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter your password.' }, { min: 8, message: 'Use at least 8 characters.' }, { max: 64 }, ...(register ? [{ pattern: /^(?=.*[a-zA-Z])(?=.*\d)[\s\S]+$/, message: 'Include at least one letter and one number.' }] : [])]}><Input.Password maxLength={64} autoComplete={register ? 'new-password' : 'current-password'} placeholder="At least 8 characters" /></Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>{register ? 'Create account' : 'Log in'}</Button>
    </Form><p className="auth-switch">{register ? 'Already have an account? ' : 'New to WeBox? '}<Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create account'}</Link></p></Card>
    <p className="muted auth-note">Sessions last 5 minutes. Your cart is saved for your next visit.</p></div>;
}
