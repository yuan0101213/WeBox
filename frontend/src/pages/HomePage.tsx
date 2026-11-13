import { useEffect, useState } from 'react';
import { Alert, Button, Card, Space, Tag, Typography } from 'antd';
import { api } from '../api/client';
import type { ApiResponse, HealthStatus } from '../types/api';

export default function HomePage() {
  const [health, setHealth] = useState<HealthStatus>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkConnection() {
    setLoading(true);
    setError('');
    setHealth(undefined);
    try {
      const response = await api.get<ApiResponse<HealthStatus>>('/health');
      setHealth(response.data.data);
    } catch {
      setError('Cannot connect to all services. Check the backend, MySQL and Redis.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void checkConnection(); }, []);

  return (
    <main>
      <Typography.Title>WeBox</Typography.Title>
      <Typography.Paragraph>Employee meal ordering</Typography.Paragraph>
      <Card title="Project setup">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text>
            The project foundation is ready. Registration, menu, cart and ordering pages will be implemented next.
          </Typography.Text>
          {health && <Space wrap>
            <Tag color="green">Backend: {health.status}</Tag>
            <Tag color="green">MySQL: {health.mysql}</Tag>
            <Tag color="green">Redis: {health.redis}</Tag>
          </Space>}
          {error && <Alert type="error" message={error} />}
          <div><Button onClick={() => void checkConnection()} loading={loading}>Check connection</Button></div>
        </Space>
      </Card>
    </main>
  );
}
