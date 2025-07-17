import { AdapterRegistry } from "../adapters/base/adapterRegister";
import { RelationshipRegistry } from "../adapters/base/relationship/RelationshipRegistry";
import { NewCore } from "./newCore";

/**
 * Configuration interface for the new core
 */
export interface CoreConfig {
  /** Database adapter configurations */
  adapters?: Record<string, any>;

  /** Relationship definitions */
  relationships?: Record<string, any>;

  /** RBAC configuration */
  rbac?: any;

  /** Performance settings */
  performance?: {
    queryTimeout?: number;
    maxComplexity?: number;
    enableCache?: boolean;
  };

  /** Security settings */
  security?: {
    maxQueryDepth?: number;
    enableAuditLog?: boolean;
  };
}

/**
 * Factory function for creating a new core instance
 */
export function createCore(
  relationshipRegistry: RelationshipRegistry,
  customAdapterRegistry?: AdapterRegistry
  
): NewCore {
  return new NewCore(relationshipRegistry, customAdapterRegistry);
}
