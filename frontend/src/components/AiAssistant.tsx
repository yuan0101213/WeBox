import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space } from 'antd';
import { useInventory } from '../api/useInventory';
import { createSseParser } from '../api/sse';
import { useCart } from '../context/CartContext';
import { money, type Dish } from '../types/business';
import DishModal from './DishModal';

type Recommendation = { dish: Dish; reason: string };
export default function AiAssistant({ date }: { date: string }) {
  const cart = useCart();
  const { stocks, loaded: stockLoaded } = useInventory(date);
  const [prompt, setPrompt] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Dish | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    setRecommendations([]); setDetail(null); setStatus(''); setError(''); setLoading(false);
    return () => { active.current?.abort(); active.current = null; };
  }, [date]);
  function stop() {
    active.current?.abort(); active.current = null;
    setLoading(false); setStatus('Recommendations stopped.');
  }
  async function ask() {
    if (!prompt.trim()) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const current = () => active.current === controller && !controller.signal.aborted;
    setRecommendations([]); setDetail(null); setError(''); setStatus('Connecting…'); setLoading(true);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let done = false;
    try {
      const token = sessionStorage.getItem('webox.token');
      const response = await fetch('/api/recommendations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: prompt.trim(), date }), signal: controller.signal,
      });
      if (response.status === 401) {
        sessionStorage.removeItem('webox.token'); window.dispatchEvent(new Event('webox:expired'));
        throw new Error('Your session has expired. Please sign in again.');
      }
      if (!response.ok || !response.body) throw new Error('Unable to get recommendations. Please try again.');
      if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('The server returned an unexpected response. Please try again.');
      const parser = createSseParser((event, raw) => {
        if (!current() || done) return;
        const value = JSON.parse(raw);
        if (event === 'status') setStatus(value.message || 'Finding dishes…');
        if (event === 'recommendation') {
          const recommendation = value as Recommendation;
          if (!recommendation.dish || !Array.isArray(recommendation.dish.optionGroups)) throw new Error('The server returned an invalid recommendation. Please try again.');
          setRecommendations(previous => [...previous.filter(item => item.dish.id !== recommendation.dish.id), { ...recommendation, dish: { ...recommendation.dish, menuDate: date } }]);
        }
        if (event === 'error') throw new Error(value.message || 'Recommendations are unavailable. Please try again.');
        if (event === 'done') { done = true; setStatus('Recommendations ready.'); }
      });
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (!done && current()) {
        const next = await reader.read();
        if (next.done) { parser.push(decoder.decode()); parser.finish(); break; }
        parser.push(decoder.decode(next.value, { stream: true }));
      }
      if (current() && !done) throw new Error('The connection ended before recommendations were complete. Please try again.');
    } catch (failure) {
      if (current()) { setError(failure instanceof Error ? failure.message : 'Unable to get recommendations. Please try again.'); setStatus(''); }
    } finally {
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (current()) { setLoading(false); active.current = null; }
    }
  }
  return <Card title="AI meal assistant" style={{ marginBottom: 24 }}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <label htmlFor="ai-meal-prompt">What would you like to eat?</label>
      <Input.TextArea id="ai-meal-prompt" maxLength={500} showCount value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="A light, high-protein lunch" autoSize={{ minRows: 2, maxRows: 4 }} />
      <Space><Button type="primary" disabled={loading || !prompt.trim()} onClick={() => void ask()}>Ask AI</Button>{loading && <Button onClick={stop}>Stop</Button>}</Space>
      <div role="status" aria-live="polite">{status}</div>
      {error && <Alert type="error" showIcon message={error} />}
      {recommendations.map(({ dish: original, reason }) => { const dish = { ...original, remainingQuantity: stocks[original.id]?.remainingQuantity ?? (stockLoaded ? 0 : original.remainingQuantity) }; return <Card key={dish.id} size="small" title={dish.name}>
        <p><strong>{money(dish.priceFen)}</strong></p><p>{reason}</p>
        {dish.remainingQuantity !== undefined && <p>{dish.remainingQuantity === 0 ? 'Sold out' : `${dish.remainingQuantity} remaining`}</p>}
        <Button disabled={cart.count >= 5 || dish.remainingQuantity === 0} onClick={() => dish.optionGroups.length ? setDetail(dish) : cart.add(dish, [])}>{dish.remainingQuantity === 0 ? 'Sold out' : dish.optionGroups.length ? 'Customize' : 'Add to cart'}</Button>
      </Card>; })}
    </Space>
    <DishModal dish={detail ? { ...detail, remainingQuantity: stocks[detail.id]?.remainingQuantity ?? (stockLoaded ? 0 : detail.remainingQuantity) } : null} onClose={() => setDetail(null)} />
  </Card>;
}
