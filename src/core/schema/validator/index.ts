import { Schema, FieldDefinition, ValidationResult, ValidationError } from '../types';
import { DataValidator } from '../data-validator';
import { Collection } from 'mongodb';

/**
 * Document Validator - Validate complete document according to schema
 */
export class DocumentValidator {
  
  /**
   * Validate complete document
   */
  static async validateDocument(
    data: any, 
    schema: Schema, 
    collection?: Collection,
    documentId?: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Basic data validation
    const dataResult = DataValidator.sanitizeAndValidate(data, schema);
    if (dataResult.errors) {
      errors.push(...dataResult.errors);
    }
    
    // Unique constraints validation (async)
    if (collection) {
      const uniqueResult = await this.validateUniqueConstraints(data, schema, collection, documentId);
      if (uniqueResult.errors) {
        errors.push(...uniqueResult.errors);
      }
    }
    
    // Business rules validation
    const businessRulesResult = this.validateBusinessRules(data, schema);
    if (businessRulesResult.errors) {
      errors.push(...businessRulesResult.errors);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      data: dataResult.data
    };
  }
  
  /**
   * Validate single field
   */
  static validateField(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required check
    if (fieldDef.required && (value === undefined || value === null || value === '')) {
      errors.push({
        name: 'REQUIRED_FIELD_MISSING',
        field: fieldName,
        error: 'REQUIRED_FIELD_MISSING',
        message: `Field '${fieldName}' is required`,
        severity: 'error'
      });
      return { valid: false, errors };
    }
    
    // Skip validation if value is empty and not required
    if (value === undefined || value === null) {
      return { valid: true };
    }
    
    // Type validation
    const typeResult = this.validateFieldType(value, fieldDef, fieldName);
    if (!typeResult.valid && typeResult.errors) {
      errors.push(...typeResult.errors);
    }
    
    // Constraint validation
    const constraintResult = this.validateFieldConstraints(value, fieldDef, fieldName);
    if (!constraintResult.valid && constraintResult.errors) {
      errors.push(...constraintResult.errors);
    }
    
    // Custom validators
    if (fieldDef.validators) {
      for (const validator of fieldDef.validators) {
        try {
          const result = validator.validator(value);
          if (result !== true) {
            errors.push({
              name: 'CUSTOM_VALIDATION',
              field: fieldName,
              error: 'CUSTOM_VALIDATION_FAILED',
              message: validator.message || (typeof result === 'string' ? result : `Custom validation failed for field '${fieldName}'`),
              severity: 'error'
            });
          }
        } catch (error: any) {
          errors.push({
            name: 'VALIDATOR_EXECUTION_ERROR',
            field: fieldName,
            error: 'VALIDATOR_EXECUTION_ERROR',
            message: `Custom validator error for field '${fieldName}': ${error.message}`,
            severity: 'error'
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  /**
   * Validate unique constraints across collection
   */
  static async validateUniqueConstraints(
    data: any, 
    schema: Schema, 
    collection: Collection,
    documentId?: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.unique && data[fieldName] !== undefined) {
        try {
          const query: any = { [fieldName]: data[fieldName] };
          if (documentId) {
            query._id = { $ne: documentId };
          }
          
          const existingDoc = await collection.findOne(query);
          if (existingDoc) {
            errors.push({
              name: 'UNIQUE_CONSTRAINT_VIOLATION',
              field: fieldName,
              error: 'DUPLICATE_VALUE',
              message: `Field '${fieldName}' must be unique. Value '${data[fieldName]}' already exists.`,
              constraint: 'unique',
              severity: 'error'
            });
          }
        } catch (error: any) {
          errors.push({
            name: 'UNIQUE_CHECK_ERROR',
            field: fieldName,
            error: 'UNIQUE_CHECK_ERROR',
            message: `Error checking uniqueness for field '${fieldName}': ${error.message}`,
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
   * Validate relationships
   */
  static async validateRelationships(
    data: any, 
    schema: Schema,
    collections: Map<string, Collection>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    if (!schema.relationships) {
      return { valid: true };
    }
    
    for (const [relationName, relationDef] of Object.entries(schema.relationships)) {
      const relatedCollection = collections.get(relationDef.collection);
      if (!relatedCollection) {
        errors.push({
          name: 'RELATIONSHIP_VALIDATION',
          field: relationName,
          error: 'COLLECTION_NOT_FOUND',
          message: `Related collection '${relationDef.collection}' not found`,
          severity: 'error'
        });
        continue;
      }
      
      // Check foreign key references
      if (relationDef.type === 'belongsTo' && relationDef.foreignKey) {
        const foreignKeyValue = data[relationDef.foreignKey];
        if (foreignKeyValue) {
          try {
            const referencedDoc = await relatedCollection.findOne({ _id: foreignKeyValue });
            if (!referencedDoc) {
              errors.push({
                name: 'RELATIONSHIP_VALIDATION',
                field: relationDef.foreignKey,
                error: 'REFERENCE_NOT_FOUND',
                message: `Referenced document with id '${foreignKeyValue}' does not exist in collection '${relationDef.collection}'`,
                severity: 'error'
              });
            }
          } catch (error: any) {
            errors.push({
              name: 'RELATIONSHIP_CHECK_ERROR',
              field: relationDef.foreignKey,
              error: 'REFERENCE_CHECK_ERROR',
              message: `Error checking reference: ${error.message}`,
              severity: 'error'
            });
          }
        }
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
  static sanitizeInput(data: any, schema: Schema): any {
    const sanitized: any = {};
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      let value = data[fieldName];
      
      // Remove fields not in schema
      if (value === undefined) {
        continue;
      }
      
      // Apply default values
      if (value === null && fieldDef.default !== undefined) {
        value = typeof fieldDef.default === 'function' 
          ? fieldDef.default() 
          : fieldDef.default;
      }
      
      // Type-specific sanitization
      if (fieldDef.type === 'string' && typeof value === 'string') {
        // Trim whitespace
        if (fieldDef.trim !== false) {
          value = value.trim();
        }
        
        // Case conversion
        if (fieldDef.lowercase) {
          value = value.toLowerCase();
        }
        if (fieldDef.uppercase) {
          value = value.toUpperCase();
        }
        
        // Escape HTML
        value = this.escapeHtml(value);
      }
      
      // Type conversion
      if (fieldDef.type === 'number' && typeof value === 'string') {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          value = numValue;
        }
      }
      
      if (fieldDef.type === 'boolean' && typeof value === 'string') {
        value = value.toLowerCase() === 'true';
      }
      
      if (fieldDef.type === 'date' && typeof value === 'string') {
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime())) {
          value = dateValue;
        }
      }
      
      sanitized[fieldName] = value;
    }
    
    return sanitized;
  }
  
  /**
   * Validate business rules
   */
  static validateBusinessRules(data: any, schema: Schema): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Cross-field validation
    const crossFieldErrors = this.validateCrossFieldConstraints(data, schema);
    errors.push(...crossFieldErrors);
    
    // Custom business rules (if defined in schema)
    if ((schema as any).businessRules) {
      for (const rule of (schema as any).businessRules) {
        try {
          const result = rule.validator(data, schema);
          if (result !== true) {
            errors.push({
              name: 'BUSINESS_RULE_VIOLATION',
              fields: rule.fields || [],
              error: 'BUSINESS_RULE_VIOLATION',
              message: rule.message || (typeof result === 'string' ? result : 'Business rule validation failed'),
              severity: 'error'
            });
          }
        } catch (error: any) {
          errors.push({
            name: 'BUSINESS_RULE_ERROR',
            fields: rule.fields || [],
            error: 'BUSINESS_RULE_ERROR',
            message: `Business rule execution error: ${error.message}`,
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
   * Generate validation schema for third-party validators
   */
  static generateValidationSchema(schema: Schema, format: 'joi' | 'jsonschema' = 'jsonschema'): any {
    if (format === 'jsonschema') {
      return this.generateJsonSchema(schema);
    } else if (format === 'joi') {
      return this.generateJoiSchema(schema);
    }
    throw new Error(`Unsupported validation schema format: ${format}`);
  }
  
  /**
   * Private helper methods
   */
  private static validateFieldType(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    return DataValidator.validateDataTypes({ [fieldName]: value }, { 
      type: fieldDef.type,
      collection: 'temp', 
      fields: { [fieldName]: fieldDef } 
    });
  }
  
  private static validateFieldConstraints(value: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    return DataValidator.validateConstraints({ [fieldName]: value }, { 
      type: fieldDef.type,
      collection: 'temp', 
      fields: { [fieldName]: fieldDef } 
    });
  }
  
  private static validateCrossFieldConstraints(data: any, schema: Schema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Common cross-field validations
    
    // Password confirmation
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      errors.push({
        name: 'PASSWORD_MISMATCH',
        fields: ['password', 'confirmPassword'],
        error: 'PASSWORD_MISMATCH',
        message: 'Password and confirmation do not match',
        severity: 'error'
      });
    }
    
    // Date ranges
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        errors.push({
          name: 'INVALID_DATE_RANGE',
          fields: ['startDate', 'endDate'],
          error: 'INVALID_DATE_RANGE',
          message: 'Start date must be before end date',
          severity: 'error'
        });
      }
    }
    
    return errors;
  }
  
  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  
  private static generateJsonSchema(schema: Schema): any {
    const jsonSchema: any = {
      type: 'object',
      properties: {},
      required: []
    };
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      jsonSchema.properties[fieldName] = this.fieldDefToJsonSchema(fieldDef);
      if (fieldDef.required) {
        jsonSchema.required.push(fieldName);
      }
    }
    
    return jsonSchema;
  }
  
  private static fieldDefToJsonSchema(fieldDef: FieldDefinition): any {
    const prop: any = {};
    
    switch (fieldDef.type) {
      case 'string':
        prop.type = 'string';
        if (fieldDef.minLength !== undefined) prop.minLength = fieldDef.minLength;
        if (fieldDef.maxLength !== undefined) prop.maxLength = fieldDef.maxLength;
        if (fieldDef.pattern) prop.pattern = fieldDef.pattern;
        if (fieldDef.enum) prop.enum = fieldDef.enum;
        if (fieldDef.format) prop.format = fieldDef.format;
        break;
      case 'number':
        prop.type = 'number';
        if (fieldDef.min !== undefined) prop.minimum = fieldDef.min;
        if (fieldDef.max !== undefined) prop.maximum = fieldDef.max;
        break;
      case 'boolean':
        prop.type = 'boolean';
        break;
      case 'date':
        prop.type = 'string';
        prop.format = 'date-time';
        break;
      case 'array':
        prop.type = 'array';
        if (fieldDef.minItems !== undefined) prop.minItems = fieldDef.minItems;
        if (fieldDef.maxItems !== undefined) prop.maxItems = fieldDef.maxItems;
        if (fieldDef.uniqueItems) prop.uniqueItems = fieldDef.uniqueItems;
        if (fieldDef.items) prop.items = this.fieldDefToJsonSchema(fieldDef.items);
        break;
      case 'object':
        prop.type = 'object';
        if (fieldDef.properties) {
          prop.properties = {};
          for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
            prop.properties[propName] = this.fieldDefToJsonSchema(propDef);
          }
        }
        break;
      default:
        prop.type = 'string';
    }
    
    if (fieldDef.description) {
      prop.description = fieldDef.description;
    }
    
    return prop;
  }
  
  private static generateJoiSchema(schema: Schema): string {
    // This would generate Joi validation schema
    // Implementation depends on whether Joi is available
    throw new Error('Joi schema generation not implemented yet');
  }
}
