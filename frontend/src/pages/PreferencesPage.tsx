import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, InputNumber, Select, Space, Spin, Typography, message } from 'antd';
import { usePreferences, type Preferences } from '../context/PreferencesContext';
import { errorMessage } from '../api/client';
const allergens = ['Peanuts', 'Dairy', 'Egg', 'Gluten', 'Soy', 'Fish', 'Shellfish'];
const cuisines = ['Chinese', 'Western', 'Japanese', 'Light Meal', 'Korean', 'Southeast Asian'];
export default function PreferencesPage() {
  const { preferences, loaded, save, error: loadError, retry } = usePreferences();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => { form.setFieldsValue({ ...preferences, budgetMin: preferences.budgetMinFen / 100, budgetMax: preferences.budgetMaxFen / 100 }); }, [preferences, form]);
  async function submit(values: Preferences & { budgetMin: number; budgetMax: number }) {
    setLoading(true); setError('');
    try {
      if (values.budgetMin > values.budgetMax) { setError('Minimum budget cannot exceed maximum budget.'); return; }
      await save({ allergens: values.allergens || [], cuisines: values.cuisines || [], spiceLevel: values.spiceLevel, taste: values.taste, budgetMinFen: Math.round(values.budgetMin * 100), budgetMaxFen: Math.round(values.budgetMax * 100) }); message.success('Preferences saved.');
    } catch (err) { setError(errorMessage(err)); } finally { setLoading(false); }
  }
  return <><Typography.Title level={2}>Dietary preferences</Typography.Title><Card style={{ maxWidth: 640 }}>{loadError && <Alert className="spaced" type="error" message={loadError} action={<Button onClick={retry}>Retry</Button>} />}<Spin spinning={!loaded && !loadError}>{error && <Alert className="spaced" type="error" message={error} />}<Form form={form} layout="vertical" onFinish={submit} disabled={!loaded}>
    <Form.Item name="allergens" label="Allergens"><Select mode="multiple" allowClear options={allergens.map(value => ({ value }))} /></Form.Item><p className="muted">We will ask for confirmation before adding dishes containing your flagged allergens.</p>
    <Form.Item name="cuisines" label="Favorite cuisines"><Select mode="multiple" allowClear options={cuisines.map(value => ({ value }))} /></Form.Item>
    <Form.Item name="spiceLevel" label="Spice preference"><Select options={['None', 'Mild', 'Medium', 'Hot'].map(value => ({ value }))} /></Form.Item>
    <Form.Item name="taste" label="Taste preference"><Select options={['Light', 'Moderate', 'Strong'].map(value => ({ value }))} /></Form.Item>
    <Space align="start"><Form.Item name="budgetMin" label="Minimum budget (¥)" rules={[{ required: true }]}><InputNumber min={0} max={10000} precision={2} /></Form.Item><Form.Item name="budgetMax" label="Maximum budget (¥)" rules={[{ required: true }]}><InputNumber min={0} max={10000} precision={2} /></Form.Item></Space>
    <p className="muted">Budget warnings will not prevent you from placing an order.</p><Button type="primary" htmlType="submit" loading={loading}>Save preferences</Button>
  </Form></Spin></Card></>;
}
