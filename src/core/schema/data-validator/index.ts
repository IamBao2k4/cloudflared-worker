import { isObject } from 'class-validator';
import { Schema, FieldDefinition, ValidationResult, ValidationError, ValidationOptions } from '../types';

/**
 * Data Validator - Validate data according to schema
 */
export class DataValidator {
  
  /**
   * Validate required fields
   */
  static validateRequiredFields(data: any, schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.required) {
        const value = data[fieldName];
        if (value === undefined || value === null || value === '') {
          errors.push({
            name: "DataValidatorError",
            field: fieldName,
            error: 'REQUIRED_FIELD_MISSING',
            message: `Field '${fieldName}' is required`,
            severity: 'error'
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Validate data types
   */
  static validateDataTypes(data: any, schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const value = data[fieldName];
      
      if (value !== undefined && value !== null) {
        const typeResult = this.validateFieldType(value, fieldDef, fieldName);
        if (!typeResult.valid && typeResult.errors) {
          errors.push(...typeResult.errors);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Validate field constraints
   */
  static validateConstraints(data: any, schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      const value = data[fieldName];
      
      if (value !== undefined && value !== null) {
        const constraintResult = this.validateFieldConstraints(value, fieldDef, fieldName);
        if (!constraintResult.valid && constraintResult.errors) {
          errors.push(...constraintResult.errors);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Sanitize and validate input data
   */
  static sanitizeAndValidate(data: any, schema: Schema, options: ValidationOptions = {}): ValidationResult {
    // Sanitize input
    const sanitized = this.sanitizeInput(data, schema, options);
    
    // Validate sanitized data
    const validationResults = [
      this.validateRequiredFields(sanitized, schema),
      this.validateDataTypes(sanitized, schema),
      this.validateConstraints(sanitized, schema)
    ];
    
    const allErrors: ValidationError[] = [];
    for (const result of validationResults) {
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }
    
    return {
      valid: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
      data: sanitized
    };
  }
  
  /**
   * Validate individual field type
   */
  private static validateFieldType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    const { type } = fieldDef;
    
    switch (type) {
      case 'string':
        return this.validateStringType(value, fieldDef, fieldName);
      case 'number':
        return this.validateNumberType(value, fieldDef, fieldName);
      case 'boolean':
        return this.validateBooleanType(value, fieldDef, fieldName);
      case 'date':
        return this.validateDateType(value, fieldDef, fieldName);
      case 'objectId':
        return this.validateObjectIdType(value, fieldDef, fieldName);
      case 'array':
        return this.validateArrayType(value, fieldDef, fieldName);
      case 'object':
        return this.validateObjectType(value, fieldDef, fieldName);
      default:
        return {
          valid: false,
          errors: [{
            name: "DataValidatorError",
            field: fieldName,
            error: 'UNKNOWN_TYPE',
            message: `Unknown field type: ${type}`,
            severity: 'error'
          }]
        };
    }
  }
  
  /**
   * Validate string type
   */
  private static validateStringType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_TYPE',
          message: `Field '${fieldName}' must be a string, got ${typeof value}`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate number type
   */
  private static validateNumberType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    let numValue = value;
    
    if (typeof value === 'string') {
      numValue = Number(value);
      if (isNaN(numValue)) {
        return {
          valid: false,
          errors: [{
            name: "DataValidatorError",
            field: fieldName,
            error: 'INVALID_NUMBER',
            message: `Field '${fieldName}' must be a valid number`,
            severity: 'error'
          }]
        };
      }
    } else if (typeof value !== 'number') {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_TYPE',
          message: `Field '${fieldName}' must be a number`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate boolean type
   */
  private static validateBooleanType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    if (typeof value !== 'boolean') {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_TYPE',
          message: `Field '${fieldName}' must be a boolean`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate date type
   */
  private static validateDateType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_DATE',
          message: `Field '${fieldName}' must be a valid date`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  

  private static isObjectId(value: any): boolean {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  
  }

  /**
   * Validate ObjectId type
   */
  private static validateObjectIdType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    if (!this.isObjectId(value)) {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_OBJECT_ID',
          message: `Field '${fieldName}' must be a valid ObjectId`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate array type
   */
  private static validateArrayType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_TYPE',
          message: `Field '${fieldName}' must be an array`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate object type
   */
  private static validateObjectType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        valid: false,
        errors: [{
          name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_TYPE',
          message: `Field '${fieldName}' must be an object`,
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate field constraints
   */
  private static validateFieldConstraints(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    // String constraints
    if (fieldDef.type === 'string' && typeof value === 'string') {
      if (fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MIN_LENGTH',
          message: `Field '${fieldName}' must be at least ${fieldDef.minLength} characters long`,
          constraint: 'minLength',
          severity: 'error'
        });
      }
      
      if (fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MAX_LENGTH',
          message: `Field '${fieldName}' cannot exceed ${fieldDef.maxLength} characters`,
          constraint: 'maxLength',
          severity: 'error'
        });
      }
      
      if (fieldDef.pattern) {
        const regex = new RegExp(fieldDef.pattern);
        if (!regex.test(value)) {
          errors.push({
            name: "DataValidatorError",
            field: fieldName,
            error: 'PATTERN_MISMATCH',
            message: `Field '${fieldName}' does not match required pattern`,
            constraint: 'pattern',
            severity: 'error'
          });
        }
      }
      
      if (fieldDef.enum && !fieldDef.enum.includes(value)) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'ENUM_VIOLATION',
          message: `Field '${fieldName}' must be one of: ${fieldDef.enum.join(', ')}`,
          constraint: 'enum',
          severity: 'error'
        });
      }
      
      if (fieldDef.format === 'email' && !this.isValidEmail(value)) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_EMAIL',
          message: `Field '${fieldName}' must be a valid email address`,
          constraint: 'format',
          severity: 'error'
        });
      }
      
      if (fieldDef.format === 'url' && !this.isValidUrl(value)) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'INVALID_URL',
          message: `Field '${fieldName}' must be a valid URL`,
          constraint: 'format',
          severity: 'error'
        });
      }
    }
    
    // Number constraints
    if (fieldDef.type === 'number' && typeof value === 'number') {
      if (fieldDef.min !== undefined && value < fieldDef.min) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MIN_VALUE',
          message: `Field '${fieldName}' must be at least ${fieldDef.min}`,
          constraint: 'min',
          severity: 'error'
        });
      }
      
      if (fieldDef.max !== undefined && value > fieldDef.max) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MAX_VALUE',
          message: `Field '${fieldName}' cannot exceed ${fieldDef.max}`,
          constraint: 'max',
          severity: 'error'
        });
      }
      
      if (fieldDef.integer && !Number.isInteger(value)) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'NOT_INTEGER',
          message: `Field '${fieldName}' must be an integer`,
          constraint: 'integer',
          severity: 'error'
        });
      }
      
      if (fieldDef.positive && value <= 0) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'NOT_POSITIVE',
          message: `Field '${fieldName}' must be positive`,
          constraint: 'positive',
          severity: 'error'
        });
      }
    }
    
    // Array constraints
    if (fieldDef.type === 'array' && Array.isArray(value)) {
      if (fieldDef.minItems !== undefined && value.length < fieldDef.minItems) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MIN_ITEMS',
          message: `Field '${fieldName}' must have at least ${fieldDef.minItems} items`,
          constraint: 'minItems',
          severity: 'error'
        });
      }
      
      if (fieldDef.maxItems !== undefined && value.length > fieldDef.maxItems) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'MAX_ITEMS',
          message: `Field '${fieldName}' cannot have more than ${fieldDef.maxItems} items`,
          constraint: 'maxItems',
          severity: 'error'
        });
      }
      
      if (fieldDef.uniqueItems && !this.hasUniqueItems(value)) {
        errors.push({
            name: "DataValidatorError",
          field: fieldName,
          error: 'DUPLICATE_ITEMS',
          message: `Field '${fieldName}' must contain unique items`,
          constraint: 'uniqueItems',
          severity: 'error'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Sanitize input data
   */
  private static sanitizeInput(data: any, schema: Schema, options: ValidationOptions): any {
    const sanitized: any = {};
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      let value = data[fieldName];
      
      // Apply default values
      if (value === undefined || value === null) {
        if (fieldDef.default !== undefined) {
          value = typeof fieldDef.default === 'function' 
            ? fieldDef.default() 
            : fieldDef.default;
        } else {
          continue;
        }
      }
      
      // Type-specific sanitization
      if (fieldDef.type === 'string' && typeof value === 'string') {
        if (fieldDef.trim !== false) {
          value = value.trim();
        }
        if (fieldDef.lowercase) {
          value = value.toLowerCase();
        }
        if (fieldDef.uppercase) {
          value = value.toUpperCase();
        }
      }
      
      sanitized[fieldName] = value;
    }
    
    // Include unknown fields if allowed
    if (options.allowUnknown) {
      for (const [key, value] of Object.entries(data)) {
        if (!schema.fields[key]) {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }
  
  /**
   * Helper methods
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  private static hasUniqueItems(array: any[]): boolean {
    const stringified = array.map(item => JSON.stringify(item));
    return new Set(stringified).size === array.length;
  }
}
