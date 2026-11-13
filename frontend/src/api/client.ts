import axios from 'axios';
export const api = axios.create({ baseURL: '/api', timeout: 10000 });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('webox.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
    sessionStorage.removeItem('webox.token');
    window.dispatchEvent(new Event('webox:expired'));
  }
  return Promise.reject(error);
});
export function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) ? error.response?.data?.message || 'Unable to reach the server. Please try again.' : 'Something went wrong. Please try again.';
}
export async function get<T>(url: string, params?: object): Promise<T> { return (await api.get(url, { params })).data.data; }
export async function post<T>(url: string, body?: unknown): Promise<T> { return (await api.post(url, body)).data.data; }
