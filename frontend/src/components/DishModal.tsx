import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Modal, Select, Tag, message } from 'antd';
import { useCart } from '../context/CartContext';
import type { Dish, Selection } from '../types/business';
import DishPhoto from './DishPhoto';
import { money } from '../types/business';
export default function DishModal({ dish, onClose }: { dish: Dish | null; onClose: () => void }) {
  const cart = useCart();
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  useEffect(() => { setChosen({}); setError(''); }, [dish?.id]);
  if (!dish) return null;
  const selections: Selection[] = dish.optionGroups.flatMap(g => g.options.filter(o => (chosen[g.id] || []).includes(o.id)).map(o => ({ groupId: g.id, optionId: o.id, name: o.name, extraPriceFen: o.extraPriceFen })));
  const price = dish.priceFen + selections.reduce((s, o) => s + o.extraPriceFen, 0);
  function add() {
    for (const g of dish!.optionGroups) {
      const count = (chosen[g.id] || []).length;
      if (count < g.minSelect || count > g.maxSelect) { setError(`Choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`} option(s) for ${g.name}.`); return; }
    }
    cart.add(dish!, selections); onClose();
  }
  return <Modal open title={dish.name} onCancel={onClose} footer={<Button type="primary" disabled={cart.count >= 5 || dish.remainingQuantity === 0} onClick={add}>Add to cart · {money(price)}</Button>}>
    <DishPhoto dish={dish} /><p>{dish.description}</p>{dish.remainingQuantity !== undefined && <p>{dish.remainingQuantity === 0 ? 'Sold out' : `${dish.remainingQuantity} remaining`}</p>}<p><Tag>{dish.category}</Tag><Tag>Spice: {dish.spiceLevel}</Tag></p>
    <p className="muted">Protein: {dish.proteins.join(', ') || 'None'}<br />Allergens: {dish.allergens.join(', ') || 'None'}</p>
    {dish.optionGroups.map(g => <div className="option-group" key={g.id}><strong>{g.name} {g.minSelect > 0 ? '(required)' : '(optional)'}</strong>
      {g.maxSelect === 1 ? <Select aria-label={g.name} allowClear={g.minSelect === 0} placeholder={`Choose ${g.name.toLowerCase()}`} value={chosen[g.id]?.[0]} options={g.options.map(o => ({ value: o.id, label: `${o.name}${o.extraPriceFen ? ` +${money(o.extraPriceFen)}` : ''}` }))} onChange={v => setChosen({ ...chosen, [g.id]: v ? [v] : [] })} /> : <Checkbox.Group value={chosen[g.id] || []} onChange={v => setChosen({ ...chosen, [g.id]: v as string[] })} options={g.options.map(o => ({ value: o.id, label: `${o.name} +${money(o.extraPriceFen)}` }))} />}
    </div>)}{error && <Alert type="error" message={error} />}
  </Modal>;
}
