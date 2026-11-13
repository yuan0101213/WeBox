import type { Dish } from '../types/business';
export default function DishPhoto({ dish }: { dish: Dish }) {
  return dish.imageUrl ? <img className="dish-thumb" src={dish.imageUrl} alt={`${dish.name} serving suggestion`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : null;
}
