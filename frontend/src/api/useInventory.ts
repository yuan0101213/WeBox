import { useEffect, useState } from 'react';
import { api, errorMessage } from './client';
export interface Stock { dishId: number; remainingQuantity: number; supplyQuantity: number }
export function useInventory(date: string) {
  const [stocks, setStocks] = useState<Record<number, Stock>>({});
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    setStocks({}); setError(''); setLoaded(false);
    async function refresh() {
      controller = new AbortController();
      try {
        const response = await api.get('/inventory', { params: { date }, signal: controller.signal });
        if (!stopped) { setStocks(Object.fromEntries((response.data.data.items as Stock[]).map(s => [s.dishId, s]))); setError(''); setLoaded(true); }
      } catch (err) { if (!stopped) setError(errorMessage(err)); }
      finally { if (!stopped) timer = setTimeout(refresh, 2000); }
    }
    if (date) void refresh();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [date]);
  return { stocks, error, loaded };
}
