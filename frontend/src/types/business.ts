export interface User { id: number; email: string; role: string }
export interface Option { id: string; name: string; extraPriceFen: number }
export interface OptionGroup { id: string; name: string; minSelect: number; maxSelect: number; options: Option[] }
export interface Selection { groupId: string; optionId: string; name: string; extraPriceFen: number }
export interface Dish { remainingQuantity?: number; supplyQuantity?: number; menuDate?: string; id: number; name: string; description: string; priceFen: number; category: string; imageUrl: string; proteins: string[]; allergens: string[]; spiceLevel: string; optionGroups: OptionGroup[] }
export interface CartItem { key: string; dish: Dish; selectedOptions: Selection[]; quantity: number; unitPriceFen: number }
export interface OrderItem { id: number; dishId: number; dishName: string; options: Selection[]; unitPriceFen: number; quantity: number; subtotalFen: number }
export interface Order { id: number; orderNo: string; deliveryDate: string; mealPeriod: string; address: string; status: string; totalFen: number; createdAt: string; items?: OrderItem[] }
export interface Page<T> { items: T[]; total: number }
export const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;
export function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
