/**
 * Error creation utilities for MongoREST
 * Provides factory functions for creating specific errors
 */

import {
  ConfigurationError,
  ValidationError,
  AuthorizationError,
  AdapterError,
  QueryError,
  RelationshipError,
  NotFoundError,
  ConnectionError,
  ErrorCodes
} from './index';

import { ErrorCode } from './errorCodes';

/**
 * Bootstrap Error Factories
 */
export const BootstrapErrors = {
  configRequired: () => 
    new ConfigurationError(ErrorCodes.BST_CONFIG_REQUIRED),
    
  coreNotInitialized: () => 
    new ConfigurationError(ErrorCodes.BST_CORE_NOT_INITIALIZED),
    
  adapterListFailed: () => 
    new ConnectionError(ErrorCodes.BST_ADAPTER_LIST_FAILED),
    
  initBuiltinFailed: (details?: any) => 
    new ConfigurationError(ErrorCodes.BST_INIT_BUILTIN_FAILED, details),
    
  initConfigFailed: (details?: any) => 
    new ConfigurationError(ErrorCodes.BST_INIT_CONFIG_FAILED, details),
    
  testConnectionFailed: (details?: any) => 
    new ConnectionError(ErrorCodes.BST_TEST_CONNECTION_FAILED, details)
};

/**
 * Core Error Factories
 */
export const CoreErrors = {
  accessDeniedRead: (collection: string, roles: string[]) => 
    new AuthorizationError(ErrorCodes.COR_ACCESS_DENIED_READ, { collection, roles }),
    
  accessDeniedCreate: (collection: string, roles: string[]) => 
    new AuthorizationError(ErrorCodes.COR_ACCESS_DENIED_CREATE, { collection, roles }),
    
  accessDeniedUpdate: (collection: string, roles: string[]) => 
    new AuthorizationError(ErrorCodes.COR_ACCESS_DENIED_UPDATE, { collection, roles }),
    
  accessDeniedDelete: (collection: string, roles: string[]) => 
    new AuthorizationError(ErrorCodes.COR_ACCESS_DENIED_DELETE, { collection, roles }),
    
  resourceNotFound: (collection: string, id: string) => 
    new NotFoundError(ErrorCodes.COR_RESOURCE_NOT_FOUND, { collection, id }),
    
  queryValidationFailed: (errors: any[]) => 
    new QueryError(ErrorCodes.COR_QUERY_VALIDATION_FAILED, { errors }),
    
  adapterContextFailed: (details?: any) => 
    new AdapterError(ErrorCodes.COR_ADAPTER_CONTEXT_FAILED, details),
    
  rbacFeaturesInvalid: () => 
    new AuthorizationError(ErrorCodes.COR_RBAC_FEATURES_INVALID),
    
  rbacFeaturesFailed: (details?: any) => 
    new AuthorizationError(ErrorCodes.COR_RBAC_FEATURES_FAILED, details),
    
  adapterNotFound: (databaseType: string, adapterName?: string) => 
    new NotFoundError(ErrorCodes.COR_ADAPTER_NOT_FOUND, { databaseType, adapterName }),
    
  relationshipNotInitialized: () => 
    new RelationshipError(ErrorCodes.COR_RELATIONSHIP_NOT_INITIALIZED),
    
  joinsInvalidType: () => 
    new QueryError(ErrorCodes.COR_JOINS_INVALID_TYPE),
    
  relationshipNotFound: (sourceCollection: string) => 
    new RelationshipError(ErrorCodes.COR_RELATIONSHIP_NOT_FOUND, { sourceCollection }),
    
  queryObjectRequired: () => 
    new QueryError(ErrorCodes.COR_QUERY_OBJECT_REQUIRED),
    
  collectionNameInvalid: () => 
    new QueryError(ErrorCodes.COR_COLLECTION_NAME_INVALID),
    
  rolesInvalidType: () => 
    new AuthorizationError(ErrorCodes.COR_ROLES_INVALID_TYPE),
    
  rbacRestrictionFailed: (details?: any) => 
    new AuthorizationError(ErrorCodes.COR_RBAC_RESTRICTION_FAILED, details)
};

/**
 * Query Converter Error Factories
 */
export const QueryErrors = {
  currentQueryNotInitialized: () => 
    new QueryError(ErrorCodes.QRY_CURRENT_QUERY_NOT_INITIALIZED)
};

/**
 * Adapter Error Factories
 */
export const AdapterErrors = {
  moduleInvalid: (modulePath: string) => 
    new AdapterError(ErrorCodes.ADP_MODULE_INVALID, { modulePath }),
    
  implementationInvalid: (modulePath: string) => 
    new AdapterError(ErrorCodes.ADP_IMPLEMENTATION_INVALID, { modulePath }),
    
  loadFailed: (modulePath: string, originalError: string) => 
    new AdapterError(ErrorCodes.ADP_LOAD_FAILED, { modulePath, originalError }),
    
  notInitialized: (adapterName: string) => 
    new AdapterError(ErrorCodes.ADP_NOT_INITIALIZED, { adapterName })
};

/**
 * RBAC Error Factories
 */
export const RbacErrors = {
  collectionNotFound: (collection: string) => 
    new ValidationError(ErrorCodes.RBC_COLLECTION_NOT_FOUND, { collection }),
    
  accessDenied: (action: string, collection: string, roles: string[]) => 
    new AuthorizationError(ErrorCodes.RBC_ACCESS_DENIED, { action, collection, roles })
};

/**
 * Create error with custom message
 */
export function createError(code: ErrorCode, details?: any, customMessage?: string) {
  const statusCode = getStatusCode(code);
  
  if (statusCode === 403) {
    return new AuthorizationError(code, details);
  } else if (statusCode === 404) {
    return new NotFoundError(code, details);
  } else if (statusCode === 400) {
    return new ValidationError(code, details);
  } else if (statusCode === 503) {
    return new ConnectionError(code, details);
  } else {
    return new AdapterError(code, details);
  }
}

// Re-export for convenience
import { getStatusCode } from './errorCodes';
export { ErrorCodes } from './index';
