import { CoreConfig } from "./main/types";

export interface QueryParams {
  [key: string]: string | string[];
}

export interface ParsedFilter {
  field: string;
  operator: string;
  value: any;
  modifier?: string;
}

export interface MongoQuery {
  filter: Record<string, any>;
  projection?: Record<string, 1 | 0>;
  sort?: Record<string, 1 | -1>;
  pipeline?: any[];
  hasEmbeds?: boolean;
  embeddedTables?: string[];
  limit?: number;
  skip?: number;
  count?: boolean;
}

export interface ConvertOptions {
  collection?: string; // Required for embeds to work
  enableEmbeds?: boolean;
  maxEmbedDepth?: number;
}



/**
 * Bootstrap configuration interface
 */
export interface BootstrapConfig {
  /** Whether to include built-in adapters (default: true) */
  includeBuiltinAdapters?: boolean;

  /** Custom adapter configurations */
  customAdapters?: CustomAdapterConfig[];

  /** Relationship definitions */
  relationships?: Record<string, any>;

  /** Core configuration */
  core?: CoreConfig;
}

export interface CustomAdapterConfig {
  /** Path to adapter module */
  path?: string;

  /** Adapter instance */
  instance?: any;

  /** Whether this adapter is required */
  required?: boolean;
}

export interface SystemStatus {
  initialized: boolean;
  adapters: {
    name: string;
    type: string;
    version: string;
    capabilities: any;
  }[];
  relationships: string[];
  supportedDatabaseTypes: string[];
}

export interface ConnectionTestResult {
  adapter: string;
  type: string;
  connected: boolean;
  error?: string;
}
