export interface ApiResponse<T> { data: T }
export interface HealthStatus {
  status: 'UP' | 'DOWN';
  mysql: 'UP' | 'DOWN';
  redis: 'UP' | 'DOWN';
}
