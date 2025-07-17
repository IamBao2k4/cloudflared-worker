/**
 * Error codes for MongoREST system
 * Format: MODULE_CONTEXT_ERROR
 */

export const ErrorCodes = {
  // Bootstrap Errors (BST) - 5xx Server Errors
  BST_CONFIG_REQUIRED: 'BST_CONFIG_REQUIRED',
  BST_CORE_NOT_INITIALIZED: 'BST_CORE_NOT_INITIALIZED',
  BST_ADAPTER_LIST_FAILED: 'BST_ADAPTER_LIST_FAILED',
  BST_INIT_BUILTIN_FAILED: 'BST_INIT_BUILTIN_FAILED',
  BST_INIT_CONFIG_FAILED: 'BST_INIT_CONFIG_FAILED',
  BST_TEST_CONNECTION_FAILED: 'BST_TEST_CONNECTION_FAILED',

  // Core/NewCore Errors (COR) - Mixed
  COR_ACCESS_DENIED_READ: 'COR_ACCESS_DENIED_READ',
  COR_ACCESS_DENIED_CREATE: 'COR_ACCESS_DENIED_CREATE',
  COR_ACCESS_DENIED_UPDATE: 'COR_ACCESS_DENIED_UPDATE',
  COR_ACCESS_DENIED_DELETE: 'COR_ACCESS_DENIED_DELETE',
  COR_RESOURCE_NOT_FOUND: 'COR_RESOURCE_NOT_FOUND',
  COR_QUERY_VALIDATION_FAILED: 'COR_QUERY_VALIDATION_FAILED',
  COR_ADAPTER_CONTEXT_FAILED: 'COR_ADAPTER_CONTEXT_FAILED',
  COR_RBAC_FEATURES_INVALID: 'COR_RBAC_FEATURES_INVALID',
  COR_RBAC_FEATURES_FAILED: 'COR_RBAC_FEATURES_FAILED',
  COR_ADAPTER_NOT_FOUND: 'COR_ADAPTER_NOT_FOUND',
  COR_RELATIONSHIP_NOT_INITIALIZED: 'COR_RELATIONSHIP_NOT_INITIALIZED',
  COR_JOINS_INVALID_TYPE: 'COR_JOINS_INVALID_TYPE',
  COR_RELATIONSHIP_NOT_FOUND: 'COR_RELATIONSHIP_NOT_FOUND',
  COR_QUERY_OBJECT_REQUIRED: 'COR_QUERY_OBJECT_REQUIRED',
  COR_COLLECTION_NAME_INVALID: 'COR_COLLECTION_NAME_INVALID',
  COR_ROLES_INVALID_TYPE: 'COR_ROLES_INVALID_TYPE',
  COR_RBAC_RESTRICTION_FAILED: 'COR_RBAC_RESTRICTION_FAILED',

  // Query Converter Errors (QRY) - 4xx Client Errors
  QRY_CURRENT_QUERY_NOT_INITIALIZED: 'QRY_CURRENT_QUERY_NOT_INITIALIZED',

  // Adapter Registry Errors (ADP) - 5xx Server Errors
  ADP_MODULE_INVALID: 'ADP_MODULE_INVALID',
  ADP_IMPLEMENTATION_INVALID: 'ADP_IMPLEMENTATION_INVALID',
  ADP_LOAD_FAILED: 'ADP_LOAD_FAILED',
  ADP_NOT_INITIALIZED: 'ADP_NOT_INITIALIZED',

  // RBAC Validator Errors (RBC) - Mixed
  RBC_COLLECTION_NOT_FOUND: 'RBC_COLLECTION_NOT_FOUND',
  RBC_ACCESS_DENIED: 'RBC_ACCESS_DENIED',

  // General Errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  WRAPPED_ERROR: 'WRAPPED_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error status codes mapping
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  // Bootstrap Errors - 5xx
  [ErrorCodes.BST_CONFIG_REQUIRED]: 500,
  [ErrorCodes.BST_CORE_NOT_INITIALIZED]: 500,
  [ErrorCodes.BST_ADAPTER_LIST_FAILED]: 503,
  [ErrorCodes.BST_INIT_BUILTIN_FAILED]: 500,
  [ErrorCodes.BST_INIT_CONFIG_FAILED]: 500,
  [ErrorCodes.BST_TEST_CONNECTION_FAILED]: 503,

  // Core Errors - Mixed
  [ErrorCodes.COR_ACCESS_DENIED_READ]: 403,
  [ErrorCodes.COR_ACCESS_DENIED_CREATE]: 403,
  [ErrorCodes.COR_ACCESS_DENIED_UPDATE]: 403,
  [ErrorCodes.COR_ACCESS_DENIED_DELETE]: 403,
  [ErrorCodes.COR_RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.COR_QUERY_VALIDATION_FAILED]: 400,
  [ErrorCodes.COR_ADAPTER_CONTEXT_FAILED]: 500,
  [ErrorCodes.COR_RBAC_FEATURES_INVALID]: 403,
  [ErrorCodes.COR_RBAC_FEATURES_FAILED]: 500,
  [ErrorCodes.COR_ADAPTER_NOT_FOUND]: 404,
  [ErrorCodes.COR_RELATIONSHIP_NOT_INITIALIZED]: 500,
  [ErrorCodes.COR_JOINS_INVALID_TYPE]: 400,
  [ErrorCodes.COR_RELATIONSHIP_NOT_FOUND]: 500,
  [ErrorCodes.COR_QUERY_OBJECT_REQUIRED]: 400,
  [ErrorCodes.COR_COLLECTION_NAME_INVALID]: 400,
  [ErrorCodes.COR_ROLES_INVALID_TYPE]: 403,
  [ErrorCodes.COR_RBAC_RESTRICTION_FAILED]: 500,

  // Query Converter Errors - 4xx
  [ErrorCodes.QRY_CURRENT_QUERY_NOT_INITIALIZED]: 400,

  // Adapter Registry Errors - 5xx
  [ErrorCodes.ADP_MODULE_INVALID]: 500,
  [ErrorCodes.ADP_IMPLEMENTATION_INVALID]: 500,
  [ErrorCodes.ADP_LOAD_FAILED]: 500,
  [ErrorCodes.ADP_NOT_INITIALIZED]: 500,

  // RBAC Errors - Mixed
  [ErrorCodes.RBC_COLLECTION_NOT_FOUND]: 400,
  [ErrorCodes.RBC_ACCESS_DENIED]: 403,

  // General Errors
  [ErrorCodes.UNKNOWN_ERROR]: 500,
  [ErrorCodes.WRAPPED_ERROR]: 500
};

/**
 * Error descriptions for better understanding
 */
export const ErrorDescriptions: Record<ErrorCode, string> = {
  // Bootstrap
  [ErrorCodes.BST_CONFIG_REQUIRED]: 'Configuration object is required for initialization',
  [ErrorCodes.BST_CORE_NOT_INITIALIZED]: 'Core system must be initialized before use',
  [ErrorCodes.BST_ADAPTER_LIST_FAILED]: 'Failed to retrieve adapter list from registry',
  [ErrorCodes.BST_INIT_BUILTIN_FAILED]: 'Failed to initialize with built-in adapters',
  [ErrorCodes.BST_INIT_CONFIG_FAILED]: 'Failed to initialize with provided configuration',
  [ErrorCodes.BST_TEST_CONNECTION_FAILED]: 'Failed to test database connections',

  // Core
  [ErrorCodes.COR_ACCESS_DENIED_READ]: 'User does not have read access to the requested collection',
  [ErrorCodes.COR_ACCESS_DENIED_CREATE]: 'User does not have create access to the requested collection',
  [ErrorCodes.COR_ACCESS_DENIED_UPDATE]: 'User does not have update access to the requested collection',
  [ErrorCodes.COR_ACCESS_DENIED_DELETE]: 'User does not have delete access to the requested collection',
  [ErrorCodes.COR_RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.COR_QUERY_VALIDATION_FAILED]: 'Query validation failed against adapter capabilities',
  [ErrorCodes.COR_ADAPTER_CONTEXT_FAILED]: 'Failed to set adapter context for query execution',
  [ErrorCodes.COR_RBAC_FEATURES_INVALID]: 'RBAC features must be returned as an array',
  [ErrorCodes.COR_RBAC_FEATURES_FAILED]: 'Failed to retrieve RBAC features for collection',
  [ErrorCodes.COR_ADAPTER_NOT_FOUND]: 'No adapter found for the specified database type',
  [ErrorCodes.COR_RELATIONSHIP_NOT_INITIALIZED]: 'Relationship registry must be initialized',
  [ErrorCodes.COR_JOINS_INVALID_TYPE]: 'Joins parameter must be an array',
  [ErrorCodes.COR_RELATIONSHIP_NOT_FOUND]: 'Failed to retrieve relationships for collection',
  [ErrorCodes.COR_QUERY_OBJECT_REQUIRED]: 'Query object is required for processing',
  [ErrorCodes.COR_COLLECTION_NAME_INVALID]: 'Valid collection name string is required',
  [ErrorCodes.COR_ROLES_INVALID_TYPE]: 'Roles parameter must be an array of strings',
  [ErrorCodes.COR_RBAC_RESTRICTION_FAILED]: 'Failed to apply RBAC field restrictions',

  // Query Converter
  [ErrorCodes.QRY_CURRENT_QUERY_NOT_INITIALIZED]: 'Current query context is not initialized',

  // Adapter Registry
  [ErrorCodes.ADP_MODULE_INVALID]: 'Invalid adapter module format',
  [ErrorCodes.ADP_IMPLEMENTATION_INVALID]: 'Invalid adapter implementation',
  [ErrorCodes.ADP_LOAD_FAILED]: 'Failed to load adapter from specified path',
  [ErrorCodes.ADP_NOT_INITIALIZED]: 'Adapter must be initialized before use',

  // RBAC
  [ErrorCodes.RBC_COLLECTION_NOT_FOUND]: 'Collection not found in RBAC configuration',
  [ErrorCodes.RBC_ACCESS_DENIED]: 'User does not have required access to perform this action',

  // General
  [ErrorCodes.UNKNOWN_ERROR]: 'An unknown error occurred',
  [ErrorCodes.WRAPPED_ERROR]: 'An error was wrapped from another source'
};

/**
 * Get status code for error code
 */
export function getStatusCode(code: ErrorCode): number {
  return ErrorStatusCodes[code] || 500;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(code: ErrorCode, details?: string): string {
  const description = ErrorDescriptions[code] || 'An error occurred';
  return details ? `${description}: ${details}` : description;
}

/**
 * Error categories for grouping
 */
export enum ErrorCategory {
  CLIENT_ERROR = '4xx',
  SERVER_ERROR = '5xx',
  PERMISSION_ERROR = '403',
  NOT_FOUND_ERROR = '404',
  VALIDATION_ERROR = '400'
}

/**
 * Get error category from status code
 */
export function getErrorCategory(statusCode: number): ErrorCategory {
  if (statusCode === 403) return ErrorCategory.PERMISSION_ERROR;
  if (statusCode === 404) return ErrorCategory.NOT_FOUND_ERROR;
  if (statusCode === 400) return ErrorCategory.VALIDATION_ERROR;
  if (statusCode >= 400 && statusCode < 500) return ErrorCategory.CLIENT_ERROR;
  return ErrorCategory.SERVER_ERROR;
}
