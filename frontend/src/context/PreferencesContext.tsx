import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, get, errorMessage } from '../api/client';
export interface Preferences { allergens: string[]; cuisines: string[]; spiceLevel: string; taste: string; budgetMinFen: number; budgetMaxFen: number }
export const defaultPreferences: Preferences = { allergens: [], cuisines: [], spiceLevel: 'None', taste: 'Moderate', budgetMinFen: 1500, budgetMaxFen: 3000 };
const Context = createContext<{ preferences: Preferences; loaded: boolean; error: string; retry: () => void; save: (value: Preferences) => Promise<void> }>(null!);
export const usePreferences = () => useContext(Context);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true; setLoaded(false); setError('');
    get<Preferences>('/preferences').then(result => { if (alive) { setPreferences(result); setLoaded(true); } }).catch(err => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [revision]);
  return <Context.Provider value={{ preferences, loaded, error, retry: () => setRevision(value => value + 1), save: async value => { if (!loaded) throw new Error('Preferences are not loaded.'); const response = await api.put('/preferences', value); setPreferences(response.data.data); } }}>{children}</Context.Provider>;
}
