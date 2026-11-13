import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { CartItem, Dish, Selection } from '../types/business';
import { Modal, message } from 'antd';
import { usePreferences } from './PreferencesContext';
import { useAuth } from './AuthContext';
interface Cart { items: CartItem[]; total: number; count: number; add: (dish: Dish, options: Selection[]) => void; quantity: (key: string, quantity: number) => void; remove: (key: string) => void; clear: () => void }
const Context = createContext<Cart>(null!);
export const useCart = () => useContext(Context);
type Action = { type: 'add'; item: CartItem } | { type: 'quantity'; key: string; value: number } | { type: 'remove'; key: string } | { type: 'clear' };
function reducer(items: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'clear': return [];
    case 'remove': return items.filter(i => i.key !== action.key);
    case 'quantity': return items.map(i => i.key === action.key ? { ...i, quantity: Math.max(1, Math.min(Math.max(1, 5 - items.filter(x => x.key !== i.key).reduce((sum, x) => sum + x.quantity, 0)), Math.floor(action.value))) } : i);
    case 'add': if (action.item.dish.remainingQuantity !== undefined && items.filter(i => i.dish.id === action.item.dish.id).reduce((s, i) => s + i.quantity, 0) >= action.item.dish.remainingQuantity) return items; if (items.reduce((sum, item) => sum + item.quantity, 0) >= 5) return items; return items.some(i => i.key === action.item.key) ? items.map(i => i.key === action.item.key ? { ...action.item, quantity: Math.min(i.quantity + 1, 5) } : i) : [...items, action.item];
  }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { preferences, loaded } = usePreferences();
  const storageKey = `webox.cart.${user!.id}`;
  const [items, dispatch] = useReducer(reducer, storageKey, key => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(saved) ? saved.filter(i => i?.dish?.id && Array.isArray(i.selectedOptions) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99 && Number.isSafeInteger(i.unitPriceFen)) as CartItem[] : [];
    } catch { return []; }
  });
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(items)), [items, storageKey]);
  const total = items.reduce((sum, i) => sum + i.unitPriceFen * i.quantity, 0);
  return <Context.Provider value={{ items, total, count: items.reduce((sum, i) => sum + i.quantity, 0),
    add: (dish, options) => {
      const selectedOptions = [...options].sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`));
      const key = `${dish.id}:${selectedOptions.map(o => `${o.groupId}:${o.optionId}`).join(',')}`;
      if (dish.remainingQuantity !== undefined && items.filter(i => i.dish.id === dish.id).reduce((sum, i) => sum + i.quantity, 0) >= dish.remainingQuantity) { message.warning('There is not enough stock for another portion of this dish.'); return; }
      if (!loaded) { message.info('Loading your preferences. Please try again.'); return; }
      if (items.reduce((sum, item) => sum + item.quantity, 0) >= 5) { message.warning('Maximum 5 meals per order.'); return; }
      const proceed = () => { dispatch({ type: 'add', item: { key, dish, selectedOptions, quantity: 1, unitPriceFen: dish.priceFen + options.reduce((s, o) => s + o.extraPriceFen, 0) } }); message.success('Added to cart'); };
      const flagged = dish.allergens.filter(a => preferences.allergens.includes(a));
      if (flagged.length) Modal.confirm({ title: 'Allergen warning', content: `This dish contains an allergen you flagged: [${flagged.join(', ')}]. Add anyway?`, okText: 'Add anyway', cancelText: 'Cancel', onOk: proceed });
      else proceed();
    },
    quantity: (key, value) => dispatch({ type: 'quantity', key, value }),
    remove: key => dispatch({ type: 'remove', key }), clear: () => dispatch({ type: 'clear' }),
  }}>{children}</Context.Provider>;
}
