import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { api, errorMessage, get, post } from '../api/client';
import type { Dish, Page } from '../types/business';
import { money, today } from '../types/business';

type ConsoleDish = Dish & { active: boolean };
type DishForm = Omit<ConsoleDish, 'id' | 'priceFen' | 'optionGroups'> & { price: number };
const categories = ['Chinese', 'Western', 'Japanese', 'Light Meal', 'Korean', 'Southeast Asian'];
const allergens = ['Peanuts', 'Dairy', 'Egg', 'Gluten', 'Soy', 'Fish', 'Shellfish'];
const options = (values: string[]) => values.map(value => ({ value }));
function tomorrow() { const date = new Date(`${today()}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }

export default function ConsolePage() {
  const [tab, setTab] = useState('dishes');
  const [keyword, setKeyword] = useState(''), [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1), [result, setResult] = useState<Page<ConsoleDish>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<ConsoleDish | null>(null), [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
  const [form] = Form.useForm<DishForm>();
  const [date, setDate] = useState(tomorrow), [allDishes, setAllDishes] = useState<ConsoleDish[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({}), [menuLoading, setMenuLoading] = useState(false), [menuReady, setMenuReady] = useState(false), [menuSaving, setMenuSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      get<Page<ConsoleDish>>('/console/dishes', { keyword, categories: selectedCategories.join(','), page, pageSize: 20 })
        .then(data => { if (!cancelled) setResult(data); })
        .catch(err => { if (!cancelled) setError(errorMessage(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [keyword, selectedCategories, page, refresh]);
  useEffect(() => {
    if (tab !== 'menu') return;
    let cancelled = false;
    setMenuLoading(true); setMenuReady(false); setError('');
    async function load() {
      const dishes: ConsoleDish[] = [];
      let current = 1, total = 1;
      while (dishes.length < total) {
        const batch = await get<Page<ConsoleDish>>('/console/dishes', { page: current++, pageSize: 50 });
        dishes.push(...batch.items); total = batch.total;
        if (!batch.items.length) break;
      }
      const entries = await get<{ dishId: number; supplyQuantity: number }[]>('/console/menu', { date });
      if (!cancelled) { setAllDishes(dishes); setQuantities(Object.fromEntries(entries.map(item => [item.dishId, item.supplyQuantity]))); setMenuReady(true); }
    }
    void load().catch(err => { if (!cancelled) setError(errorMessage(err)); }).finally(() => { if (!cancelled) setMenuLoading(false); });
    return () => { cancelled = true; };
  }, [tab, date, refresh]);
  function edit(dish?: ConsoleDish) {
    setEditing(dish || null); form.resetFields();
    form.setFieldsValue(dish ? { ...dish, price: dish.priceFen / 100 } : { name: '', description: '', price: 0, category: 'Chinese', imageUrl: '', proteins: [], allergens: [], spiceLevel: 'None', active: true });
    setOpen(true);
  }
  async function save(values: DishForm) {
    setSaving(true);
    const { price, ...fields } = values;
    const body = { ...fields, imageUrl: fields.imageUrl || '', description: fields.description || '', proteins: fields.proteins || [], allergens: fields.allergens || [], priceFen: Math.round(price * 100), optionGroups: editing?.optionGroups || [] };
    try { if (editing) await api.put(`/console/dishes/${editing.id}`, body); else await post('/console/dishes', body); setOpen(false); setRefresh(value => value + 1); message.success('Dish saved.'); }
    catch (err) { message.error(errorMessage(err)); } finally { setSaving(false); }
  }
  const upload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try { const body = new FormData(); body.append('file', file as File); const data = await post<{ url: string }>('/console/images', body); form.setFieldValue('imageUrl', data.url); onSuccess?.(data); message.success('Image uploaded. Save the dish to apply it.'); }
    catch (err) { message.error(errorMessage(err)); onError?.(err as Error); } finally { setUploading(false); }
  };
  async function status(dish: ConsoleDish) {
    try { await api.patch(`/console/dishes/${dish.id}/status`, { active: !dish.active }); setRefresh(value => value + 1); }
    catch (err) { message.error(errorMessage(err)); }
  }
  async function saveMenu() {
    setMenuSaving(true);
    try { await api.put('/console/menu', { date, items: Object.entries(quantities).map(([dishId, supplyQuantity]) => ({ dishId: Number(dishId), supplyQuantity })) }); message.success('Daily menu saved.'); }
    catch (err) { message.error(errorMessage(err)); } finally { setMenuSaving(false); }
  }
  return <><Typography.Title level={2}>Console</Typography.Title>{error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
    <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'dishes', label: 'Dishes', children: <>
      <Space wrap style={{ marginBottom: 16 }}><Input.Search aria-label="Search dishes" placeholder="Search dishes" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} allowClear /><Select aria-label="Filter categories" mode="multiple" placeholder="All categories" style={{ minWidth: 240 }} options={options(categories)} value={selectedCategories} onChange={value => { setSelectedCategories(value); setPage(1); }} allowClear /><Button type="primary" onClick={() => edit()}>Add dish</Button></Space>
      <Table<ConsoleDish> rowKey="id" loading={loading} dataSource={result.items} scroll={{ x: 700 }} pagination={{ current: page, pageSize: 20, total: result.total, showSizeChanger: false, onChange: setPage }} columns={[
        { title: 'Name', dataIndex: 'name' }, { title: 'Category', dataIndex: 'category' }, { title: 'Price', dataIndex: 'priceFen', render: money },
        { title: 'Status', dataIndex: 'active', render: active => <Tag>{active ? 'Active' : 'Inactive'}</Tag> },
        { title: 'Actions', render: (_, dish) => <Space><Button onClick={() => edit(dish)}>Edit</Button><Button onClick={() => void status(dish)}>{dish.active ? 'Take off sale' : 'Put on sale'}</Button></Space> },
      ]} />
    </> }, { key: 'menu', label: 'Daily menu', children: <>
      <Space wrap style={{ marginBottom: 16 }}><label>Menu date <input aria-label="Daily menu date" type="date" value={date} onChange={event => { if (event.target.value) { setMenuReady(false); setDate(event.target.value); } }} /></label><Button type="primary" disabled={!menuReady || menuLoading} loading={menuSaving} onClick={() => void saveMenu()}>Save daily menu</Button></Space>
      <Table<ConsoleDish> rowKey="id" loading={menuLoading} dataSource={allDishes} pagination={{ pageSize: 20, showSizeChanger: false }} rowSelection={{ selectedRowKeys: Object.keys(quantities).map(Number), preserveSelectedRowKeys: true, getCheckboxProps: dish => ({ disabled: !dish.active && quantities[dish.id] === undefined }), onChange: keys => setQuantities(previous => Object.fromEntries(keys.map(key => [Number(key), previous[Number(key)] ?? 1]))) }} columns={[
        { title: 'Dish', dataIndex: 'name' }, { title: 'Category', dataIndex: 'category' }, { title: 'Status', render: (_, dish) => dish.active ? 'Active' : 'Inactive' },
        { title: 'Supply quantity', render: (_, dish) => <InputNumber aria-label={`Supply quantity for ${dish.name}`} min={1} max={100000} precision={0} disabled={quantities[dish.id] === undefined} value={quantities[dish.id]} onChange={value => setQuantities(previous => ({ ...previous, [dish.id]: value ?? 1 }))} /> },
      ]} />
    </> }]} />
    <Modal title={editing ? 'Edit dish' : 'Add dish'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saving} okButtonProps={{ disabled: uploading }} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea maxLength={2000} /></Form.Item>
        <Form.Item name="price" label="Price (CNY)" rules={[{ required: true }]}><InputNumber min={0} max={10000} precision={2} /></Form.Item>
        <Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={options(categories)} /></Form.Item>
        <Form.Item name="allergens" label="Allergens"><Select mode="multiple" options={options(allergens)} /></Form.Item>
        <Form.Item name="proteins" label="Proteins"><Select mode="tags" tokenSeparators={[',']} options={options(['Chicken', 'Beef', 'Pork', 'Fish', 'Tofu'])} /></Form.Item>
        <Form.Item name="spiceLevel" label="Spice level" rules={[{ required: true }]}><Select options={options(['None', 'Mild', 'Medium', 'Hot'])} /></Form.Item>
        <Form.Item name="imageUrl" label="Image URL"><Input maxLength={2000} /></Form.Item>
        <Form.Item label="Upload image"><Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} customRequest={upload} beforeUpload={file => { if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { message.error('Choose a JPG, PNG or WebP image up to 5 MB.'); return Upload.LIST_IGNORE; } return true; }}><Button loading={uploading}>Choose image</Button></Upload></Form.Item>
        <Form.Item name="active" label="On sale" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </>;
}
