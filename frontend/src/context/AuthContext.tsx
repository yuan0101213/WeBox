import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, post } from '../api/client';
import type { User } from '../types/business';

interface Auth { user: User | null; loading: boolean; expired: boolean; login: (token: string, user: User) => void; logout: () => Promise<void> }
const Context = createContext<Auth>(null!);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onExpired = () => { setUser(null); setExpired(true); };
    window.addEventListener('webox:expired', onExpired);
    if (sessionStorage.getItem('webox.token')) get<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    else setLoading(false);
    return () => window.removeEventListener('webox:expired', onExpired);
  }, []);
  return <Context.Provider value={{ user, loading, expired,
    login: (token, next) => { sessionStorage.setItem('webox.token', token); setExpired(false); setUser(next); },
    logout: async () => { try { await post('/auth/logout'); } finally { sessionStorage.removeItem('webox.token'); setUser(null); setExpired(false); } },
  }}>{children}</Context.Provider>;
}
