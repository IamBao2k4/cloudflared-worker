import { 
  IntermediateQuery, 
  IntermediateQueryResult 
} from '../../types/intermediateQuery';


export interface DatabaseAdapter {
  /** Adapter name/identifier */
  readonly name: string;
  
  /** Database type */
  readonly type: DatabaseType;
  
  /** Adapter version */
  readonly version: string;

  /**
   * Convert intermediate query to native database query
   */
  convertQuery(query: IntermediateQuery): any;

  /**
   * Execute the converted query
   */
  executeQuery<T = any>(collectionName: string, intermediateQuery: IntermediateQuery,nativeQuery: any, options?: ExecutionOptions): Promise<IntermediateQueryResult<T>>;

  /**
   * Validate if the intermediate query is supported
   */
  validateQuery(query: IntermediateQuery): ValidationResult;

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapabilities;

  /**
   * Initialize adapter with configuration
   */
  initialize(config: AdapterConfig): Promise<void>;

  /**
   * Cleanup adapter resources
   */
  dispose(): Promise<void>;

  /**
   * Test adapter connection
   */
  testConnection(): Promise<boolean>;

}

export type DatabaseType = 
  | 'mongodb' | 'postgresql' | 'mysql' | 'elasticsearch' 
  | 'redis' | 'sqlite' | 'oracle' | 'custom' | 'mock';

export interface ExecutionOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to return raw results */
  raw?: boolean;
  
  /** Transaction context */
  transaction?: any;
  
  /** Additional driver-specific options */
  driverOptions?: Record<string, any>;
}

export interface ValidationResult {
  /** Whether the query is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Warnings (non-blocking) */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /** Error code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Path to the problematic part of query */
  path?: string;
  
  /** Suggested fix */
  suggestion?: string;
}

export interface ValidationWarning {
  /** Warning code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Path to the concerning part of query */
  path?: string;
}

export interface AdapterCapabilities {
  /** Supported filter operators */
  filterOperators: string[];
  
  /** Supported join types */
  joinTypes: string[];
  
  /** Supported aggregation functions */
  aggregations: string[];
  
  /** Whether full-text search is supported */
  fullTextSearch: boolean;
  
  /** Whether transactions are supported */
  transactions: boolean;
  
  /** Whether nested queries are supported */
  nestedQueries: boolean;
  
  /** Maximum query complexity */
  maxComplexity?: number;
  
  /** Maximum result size */
  maxResultSize?: number;
  
  /** Custom capabilities */
  custom?: Record<string, any>;
}

export interface AdapterConfig {
  /** Connection configuration */
  connection: ConnectionConfig;
  
  /** Performance settings */
  performance?: PerformanceConfig;
  
  /** Security settings */
  security?: SecurityConfig;
  
  /** Adapter-specific settings */
  custom?: Record<string, any>;
}

export interface ConnectionConfig {
  /** Database host */
  host?: string;
  
  /** Database port */
  port?: number;
  
  /** Database name */
  database?: string;
  
  /** Username */
  username?: string;
  
  /** Password */
  password?: string;
  
  /** Connection string (alternative to individual params) */
  connectionString?: string;
  
  /** Connection pool settings */
  pool?: {
    min?: number;
    max?: number;
    idle?: number;
    acquire?: number;
  };
  
  /** SSL configuration */
  ssl?: boolean | Record<string, any>;
}

export interface PerformanceConfig {
  /** Query timeout in milliseconds */
  queryTimeout?: number;
  
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  
  /** Enable query caching */
  enableCache?: boolean;
  
  /** Cache TTL in seconds */
  cacheTTL?: number;
  
  /** Enable query optimization */
  optimize?: boolean;
}

export interface SecurityConfig {
  /** Enable SQL injection protection */
  sqlInjectionProtection?: boolean;
  
  /** Maximum query depth */
  maxQueryDepth?: number;
  
  /** Enable audit logging */
  auditLog?: boolean;
  
  /** Allowed operations */
  allowedOperations?: string[];
}


export interface AdapterPluginConfig {
  adapters: {
    path?: string;
    package?: string;
    required?: boolean;
    config?: any;
  }[];
}

export interface AdapterInfo {
  key: string;
  name: string;
  type: DatabaseType;
  version: string;
  capabilities: any;
}