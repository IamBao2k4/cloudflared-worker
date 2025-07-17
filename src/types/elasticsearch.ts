export interface ElasticsearchConfig {
  node: string;
  username?: string;
  password?: string;
  index: string;
  enabled: boolean;
}

export interface ApiLogData {
  timestamp: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  statusCode: number;
  responseTime: number;
  requestBody?: any;
  responseBody?: any;
  queryParams?: Record<string, any>;
  headers: Record<string, any>;
  userId?: string;
  errorMessage?: string;
  appName: string;
  environment: string;
  traceId?: string;
}

export interface EnvironmentVariables {
  PORT: number;
  ELASTICSEARCH_NODE: string;
  ELASTICSEARCH_USERNAME: string;
  ELASTICSEARCH_PASSWORD: string;
  ELASTICSEARCH_INDEX: string;
  ELASTICSEARCH_ENABLED: boolean;
  APP_NAME: string;
  NODE_ENV: 'development' | 'production' | 'test';
}
