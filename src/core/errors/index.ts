/**
 * Custom error classes for MongoREST core
 */

import { ErrorCode, ErrorCodes, getErrorMessage, getStatusCode } from './errorCodes';

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    description?: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    details?: any;
    stack?: string;
  };
}

/**
 * Base error class for all MongoREST errors
 */
export class MongoRESTError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
    details?: any,
    customMessage?: string
  ) {
    const message = customMessage || getErrorMessage(code, typeof details === 'string' ? details : undefined);
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = getStatusCode(code); // Auto get status code from error code
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to response format
   */
  toResponse(includeStack: boolean = false, path?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        description: getErrorMessage(this.code),
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        path,
        details: this.details,
        ...(includeStack && this.stack ? { stack: this.stack } : {})
      }
    };
  }
}

/**
 * Configuration error - thrown when there's an issue with configuration
 */
export class ConfigurationError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Validation error - thrown when validation fails
 */
export class ValidationError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Authorization error - thrown when user lacks permissions
 */
export class AuthorizationError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Adapter error - thrown when adapter operations fail
 */
export class AdapterError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Query error - thrown when query processing fails
 */
export class QueryError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Relationship error - thrown when relationship operations fail
 */
export class RelationshipError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Not found error - thrown when requested resource doesn't exist
 */
export class NotFoundError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Connection error - thrown when database connection fails
 */
export class ConnectionError extends MongoRESTError {
  constructor(code: ErrorCode, details?: any) {
    super(code, details);
  }
}

/**
 * Type guard to check if an error is a MongoRESTError
 */
export function isMongoRESTError(error: unknown): error is MongoRESTError {
  return error instanceof MongoRESTError;
}

/**
 * Helper function to wrap unknown errors
 */
export function wrapError(error: unknown, code: ErrorCode = ErrorCodes.WRAPPED_ERROR): MongoRESTError {
  if (isMongoRESTError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new MongoRESTError(code, {
      originalError: error.name,
      originalMessage: error.message,
      stack: error.stack
    });
  }
  
  return new MongoRESTError(code, { originalError: error });
}

/**
 * Convert any error to ErrorResponse format
 */
export function toErrorResponse(
  error: unknown,
  includeStack: boolean = false,
  path?: string
): ErrorResponse {
  if (isMongoRESTError(error)) {
    return error.toResponse(includeStack, path);
  }

  const wrappedError = wrapError(error);
  return wrappedError.toResponse(includeStack, path);
}

// Re-export error codes and utilities for convenience
export { ErrorCodes, ErrorCode, getErrorMessage, getStatusCode, ErrorCategory, getErrorCategory } from './errorCodes';
