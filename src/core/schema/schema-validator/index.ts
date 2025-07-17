import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Schema, FieldDefinition, ValidationError, ValidationResult, Relationship } from '../types';

/**
 * Schema Validator - Validates JSON Schema Definitions using AJV
 */
export class SchemaValidator {
  private static ajv: Ajv;
  private static schemaValidator: ValidateFunction<any>;
  private static functionSchemaValidator: ValidateFunction<any>;
  private static rbacSchemaValidator: ValidateFunction<any>;
  
  static {
    // Initialize AJV instance
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false,
      removeAdditional: false
    });
    
    // Add format support
    addFormats(this.ajv);
    
    // Define the main schema validation schema
    this.schemaValidator = this.ajv.compile(this.getSchemaDefinitionSchema());
    
    // Define the function schema validation schema
    this.functionSchemaValidator = this.ajv.compile(this.getFunctionSchemaDefinitionSchema());

    // Define the RBAC schema validation schema
    this.rbacSchemaValidator = this.ajv.compile(this.getRbacSchemaDefinitionSchema());
  }
  
  /**
   * Validate complete schema definition using AJV
   */
  static validateSchemaDefinition(schema: any): ValidationResult {
    // First validate with AJV
    const isValid = this.schemaValidator(schema);
    const errors: ValidationError[] = [];
    
    if (!isValid && this.schemaValidator.errors) {
      // Convert AJV errors to our error format
      for (const error of this.schemaValidator.errors) {
        errors.push({
          name: "SchemaValidationError",
          field: error.instancePath?.replace('/', '') || error.keyword,
          error: error.keyword?.toUpperCase() || 'VALIDATION_ERROR',
          message: error.message || 'Validation failed',
          severity: 'error'
        });
      }
    }
    
    // Additional custom validations only if basic AJV validation passed
    if (errors.length === 0) {
      if (schema.fields) {
        const customErrors = this.performCustomValidations(schema);
        errors.push(...customErrors);
      }
      
      if (schema.relationships) {
        const relationshipErrors = this.validateRelationshipDefinitions(schema.relationships, new Map());
        errors.push(...relationshipErrors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Validate function schema definition using AJV
   */
  static validateFunctionSchemaDefinition(schema: any): ValidationResult {
    // First validate with AJV
    const isValid = this.functionSchemaValidator(schema);
    const errors: ValidationError[] = [];
    
    if (!isValid && this.functionSchemaValidator.errors) {
      // Convert AJV errors to our error format
      for (const error of this.functionSchemaValidator.errors) {
        errors.push({
          name: "FunctionSchemaValidationError",
          field: error.instancePath?.replace('/', '') || error.keyword,
          error: error.keyword?.toUpperCase() || 'VALIDATION_ERROR',
          message: error.message || 'Function schema validation failed',
          severity: 'error'
        });
      }
    }
    
    // Additional custom validations for functions
    if (errors.length === 0) {
      const customErrors = this.performFunctionCustomValidations(schema);
      errors.push(...customErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Validate rbac schema definition using AJV
   */
  
  static validateRBACSchemaDefinition(schema: any): ValidationResult {
    const isValid = this.rbacSchemaValidator(schema);
    const errors: ValidationError[] = [];
    if (!isValid && this.rbacSchemaValidator.errors) {
      for (const error of this.rbacSchemaValidator.errors) {
        errors.push({
          name: "RBACSchemaValidationError",
          field: error.instancePath?.replace('/', '') || error.keyword,
          error: error.keyword?.toUpperCase() || 'VALIDATION_ERROR',
          message: error.message || 'RBAC schema validation failed',
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
   * Validate field definition using AJV
   */
  static validateFieldDefinition(fieldName: string, fieldDef: any): ValidationError[] {
    const fieldSchema = this.getFieldDefinitionSchema();
    const validator = this.ajv.compile(fieldSchema);
    
    const isValid = validator(fieldDef);
    const errors: ValidationError[] = [];
    
    if (!isValid && validator.errors) {
      for (const error of validator.errors) {
        errors.push({
          name: "FieldValidationError",
          field: fieldName,
          error: error.keyword?.toUpperCase() || 'FIELD_VALIDATION_ERROR',
          message: `Field '${fieldName}': ${error.message}`,
          severity: 'error'
        });
      }
    }
    
    // Type-specific validation
    const typeErrors = this.validateFieldTypeSpecific(fieldName, fieldDef);
    errors.push(...typeErrors);
    
    return errors;
  }
  
  /**
   * Create AJV validator for custom field type
   */
  static createFieldTypeValidator(fieldDef: FieldDefinition): ValidateFunction<any> {
    const schema = this.fieldDefinitionToAjvSchema(fieldDef);
    return this.ajv.compile(schema);
  }
  
  /**
   * Validate data against field definition using AJV
   */
  static validateDataWithAjv(data: any, fieldDef: FieldDefinition, fieldName: string): ValidationResult {
    const validator = this.createFieldTypeValidator(fieldDef);
    const isValid = validator(data);
    
    const errors: ValidationError[] = [];
    if (!isValid && validator.errors) {
      for (const error of validator.errors) {
        errors.push({
          name: "DataValidationError",
          field: fieldName,
          error: error.keyword?.toUpperCase() || 'DATA_VALIDATION_ERROR',
          message: error.message || 'Data validation failed',
          severity: 'error',
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Generate JSON Schema from field definition
   */
  static generateJsonSchema(schema: Schema): any {
    const jsonSchema: any = {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    };
    
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      jsonSchema.properties[fieldName] = this.fieldDefinitionToAjvSchema(fieldDef);
      if (fieldDef.required) {
        jsonSchema.required.push(fieldName);
      }
    }
    
    return jsonSchema;
  }
  
  /**
   * Detect circular dependencies between schemas
   */
  static detectCircularDependencies(schemas: Map<string, Schema>): ValidationError[] {
    const dependencies = new Map<string, string[]>();
    const errors: ValidationError[] = [];
    
    // Build dependency graph
    for (const [collectionName, schema] of schemas) {
      dependencies.set(collectionName, []);
      
      if (schema.relationships) {
        for (const [relName, relDef] of Object.entries(schema.relationships)) {
          if (relDef.collection) {
            dependencies.get(collectionName)!.push(relDef.collection);
          }
        }
      }
    }
    
    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (collection: string, path: string[] = []): boolean => {
      if (recursionStack.has(collection)) {
        errors.push({
          name: "CircularDependencyError",
          error: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected: ${[...path, collection].join(' -> ')}`,
          severity: 'error'
        });
        return true;
      }
      
      if (visited.has(collection)) {
        return false;
      }
      
      visited.add(collection);
      recursionStack.add(collection);
      
      const deps = dependencies.get(collection) || [];
      for (const dep of deps) {
        if (hasCycle(dep, [...path, collection])) {
          return true;
        }
      }
      
      recursionStack.delete(collection);
      return false;
    };
    
    for (const collection of dependencies.keys()) {
      if (!visited.has(collection)) {
        hasCycle(collection);
      }
    }
    
    return errors;
  }
  
  /**
   * Generate validation report with errors and suggestions
   */
  static generateValidationReport(schema: any, errors: ValidationError[]): any {
    const report = {
      valid: errors.length === 0,
      schema: schema.collection,
      errorCount: errors.length,
      errors: [] as ValidationError[],
      warnings: [] as ValidationError[],
      suggestions: [] as string[]
    };
    
    // Categorize errors by severity
    for (const error of errors) {
      if (error.severity === 'warning') {
        report.warnings.push(error);
      } else {
        report.errors.push(error);
      }
    }
    
    // Generate helpful suggestions
    report.suggestions = this.generateValidationSuggestions(schema, errors);
    
    return report;
  }
  
  /**
   * Private helper methods
   */
  private static getFunctionSchemaDefinitionSchema(): any {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
          minLength: 1
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$'
        },
        description: {
          type: 'string',
          minLength: 1
        },
        category: {
          type: 'string',
          enum: ['reports', 'integrations', 'integration', 'analytics', 'utility', 'automation']
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        },
        endpoint: {
          type: 'string',
          pattern: '^/.*'
        },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1
        },
        rateLimits: {
          type: 'object',
          properties: {
            requests: { type: 'integer', minimum: 1 },
            window: { type: 'string', pattern: '^\\d+[smhd]$' }
          },
          required: ['requests', 'window'],
          additionalProperties: true
        },
        input: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['object'] },
            properties: { type: 'object' },
            required: { 
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['type'],
          additionalProperties: true
        },
        output: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['object'] },
            properties: { type: 'object' }
          },
          required: ['type'],
          additionalProperties: true
        },
        steps: {
          type: 'array',
          items: {
            $ref: '#/$defs/stepDefinition'
          },
          minItems: 1
        },
        hooks: {
          type: 'object',
          properties: {
            beforeExecution: {
              type: 'array',
              items: { type: 'string' }
            },
            afterExecution: {
              type: 'array',
              items: { type: 'string' }
            },
            onError: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: true
        },
        errorHandling: {
          type: 'object',
          additionalProperties: true
        },
        caching: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            ttl: { type: 'integer', minimum: 0 },
            key: { type: 'string' }
          },
          required: ['enabled'],
          additionalProperties: true
        },
        timeout: {
          type: 'integer',
          minimum: 1000,
          maximum: 300000
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true
        }
      },
      required: ['name', 'version', 'description', 'category', 'method', 'endpoint', 'permissions', 'input', 'output', 'steps'],
      additionalProperties: true,
      $defs: {
        stepDefinition: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
            },
            type: {
              type: 'string',
              enum: ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate', 'transform', 'conditional', 'http']
            },
            collection: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
            },
            query: { type: 'object' },
            filter: { type: 'object' },
            document: { type: 'object' },
            update: { type: 'object' },
            pipeline: { type: 'array' },
            script: { type: 'string' },
            input: {},
            options: { type: 'object' },
            condition: { type: 'object' },
            then: {
              type: 'object',
              additionalProperties: true
            },
            else: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
            },
            url: { type: 'string' },
            headers: { type: 'object' },
            body: {},
            timeout: { type: 'integer', minimum: 0 }
          },
          required: ['id', 'type'],
          additionalProperties: true
        }
      }
    };
  }

  private static getSchemaDefinitionSchema(): any {
    return {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
        },
        fields: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z_][a-zA-Z0-9_-]*$': {
              $ref: '#/$defs/fieldDefinition'
            }
          },
          additionalProperties: true,
          minProperties: 1
        },
        relationships: {
          type: ['object', 'null'],
          patternProperties: {
            '^[a-zA-Z_][a-zA-Z0-9_]*$': {
              $ref: '#/$defs/relationshipDefinition'
            }
          },
          additionalProperties: true
        },
        indexes: {
          type: ['array', 'null'],
          items: {
            $ref: '#/$defs/indexDefinition'
          }
        },
        access: {
          type: ['object', 'null']
        },
        timestamps: {
          type: ['boolean', 'null']
        },
        softDelete: {
          type: ['boolean', 'null']
        }
      },
      required: ['collection'],
      additionalProperties: true,
      $defs: {
        fieldDefinition: {
          type: 'object',
          properties: {
            // Basic properties
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean', 'date', 'objectId', 'array', 'object', 'mixed', 'buffer', 'decimal', 'integer']
            },
            widget: {
              type: ['string', 'null'],
              enum: ['shortAnswer', 'password', 'textarea', 'UriKeyGen', 'numberInput', 'range', 
                     'dateTime', 'date', 'time', 'radio', 'select', 'checkbox', 'boolean', 
                     'relation', 'file', 'multipleFiles', 'multiImage', 'condition', 
                     'dataWidget', 'href', 'icon', 'function', 'array', 'data', null]
            },
            title: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            default: { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] },
            required: { type: ['boolean', 'null'] },
            unique: { type: ['boolean', 'null'] },
            index: { type: ['boolean', 'null'] },
            disabled: { type: ['boolean', 'null'] },
            
            // String validation
            minLength: { type: ['integer', 'null'], minimum: 0 },
            maxLength: { type: ['integer', 'null'], minimum: 1 },
            pattern: { type: ['string', 'null'] },
            enum: { 
              oneOf: [
                { type: 'array', items: { type: 'string' } },
                { type: 'null' }
              ]
            },
            format: { type: ['string', 'null'], enum: ['email', 'url', 'uuid', 'phone', 'uri', 'date', 'date-time', 'time', null] },
            
            // Number validation
            min: { type: ['number', 'null'] },
            max: { type: ['number', 'null'] },
            minimum: { type: ['number', 'null'] },
            maximum: { type: ['number', 'null'] },
            integer: { type: ['boolean', 'null'] },
            positive: { type: ['boolean', 'null'] },
            
            // Array validation
            minItems: { type: ['integer', 'null'], minimum: 0 },
            maxItems: { type: ['integer', 'null'], minimum: 1 },
            uniqueItems: { type: ['boolean', 'null'] },
            items: { 
              oneOf: [
                { $ref: '#/$defs/fieldDefinition' },
                { type: 'object' },
                { type: 'null' }
              ]
            },
            
            // Object validation
            properties: { 
              type: ['object', 'null'],
              patternProperties: {
                '^[a-zA-Z_][a-zA-Z0-9_]*$': {
                  $ref: '#/$defs/fieldDefinition'
                }
              },
              additionalProperties: true
            },
            
            // Widget-specific properties from all-fields.json
            'format-data': { 
              type: ['string', 'null'],
              enum: ['none', 'email', 'phone', 'money', null]
            },
            customRole: { type: ['string', 'null'] },
            displayFormat: { type: ['string', 'null'] },
            formatDate: { type: ['string', 'null'] },
            field: { type: ['string', 'null'] },
            mode: { type: ['string', 'null'] },
            
            // Choice-based fields
            choices: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      value: { type: 'string' }
                    },
                    required: ['key', 'value']
                  }
                },
                { type: 'null' }
              ]
            },
            allowNull: { type: ['boolean', 'null'] },
            allowCustom: { type: ['boolean', 'null'] },
            isMultiple: { type: ['boolean', 'null'] },
            returnValue: { type: ['integer', 'null'] },
            layout: { type: ['integer', 'null'] },
            toggleAll: { type: ['boolean', 'null'] },
            appearance: { type: ['string', 'null'] },
            
            // Relation field
            typeRelation: {
              type: ['object', 'null'],
              properties: {
                title: { type: 'string' },
                entity: { type: 'string' },
                type: { 
                  type: 'string',
                  enum: ['n-1', '1-n', 'n-n', '1-1']
                },
                filter: {
                  type: 'object',
                  properties: {
                    combinator: { type: 'string', enum: ['and', 'or'] },
                    rules: { type: 'array' },
                    id: { type: 'string' }
                  }
                }
              }
            },
            
            // File fields
            meta: { type: ['string', 'null'] },
            library_setting: { type: ['string', 'null'] },
            fields: {
              type: ['array', 'null'],
              items: { type: 'string' }
            },
            
            // Other specific properties
            typeUI: { type: ['string', 'null'] },
            hiddenTitle: { type: ['boolean', 'null'] },
            
            // Additional validation
            example: { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] }
          },
          required: ['type'],
          additionalProperties: true
        },
        relationshipDefinition: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['hasOne', 'hasMany', 'belongsTo', 'manyToMany']
            },
            collection: { type: 'string' },
            foreignField: { type: ['string', 'null'] },
            localField: { type: ['string', 'null'] },
            through: { type: ['string', 'null'] },
            widget: {
              type: ['string', 'null'],
              enum: ['relation', null]
            },
            typeRelation: {
              type: ['object', 'null'],
              properties: {
                type: { 
                  type: 'string',
                  enum: ['n-1', '1-n', 'n-n', '1-1']
                },
                entity: { type: ['string', 'null'] },
                filter: { type: ['object', 'null'] }
              }
            }
          },
          required: ['type', 'collection'],
          additionalProperties: true
        },
        indexDefinition: {
          type: 'object',
          properties: {
            name: { type: ['string', 'null'] },
            fields: {
              type: 'object',
              patternProperties: {
                '^[a-zA-Z_][a-zA-Z0-9_.]*$': {
                  oneOf: [
                    { type: 'integer', enum: [1, -1] },
                    { type: 'string', enum: ['text', '2dsphere'] }
                  ]
                }
              },
              additionalProperties: true
            },
            options: {
              type: ['object', 'null'],
              properties: {
                unique: { type: ['boolean', 'null'] },
                sparse: { type: ['boolean', 'null'] },
                background: { type: ['boolean', 'null'] },
                expireAfterSeconds: { type: ['integer', 'null'], minimum: 0 }
              },
              additionalProperties: true
            }
          },
          required: ['fields'],
          additionalProperties: true
        }
      }
    };
  }
  private static getRbacSchemaDefinitionSchema(): any {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 1
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$'
        },
        description: {
          type: 'string',
          minLength: 1
        },
        collections: {
          type: 'array',
          items: {
            $ref: '#/$defs/collectionRbacDefinition'
          },
          minItems: 1
        }
      },
      required: ['name', 'collections'],
      additionalProperties: false,
      $defs: {
        collectionRbacDefinition: {
          type: 'object',
          properties: {
            collection_name: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
              minLength: 1
            },
            rbac_config: {
              $ref: '#/$defs/rbacConfig'
            }
          },
          required: ['collection_name', 'rbac_config'],
          additionalProperties: false
        },
        rbacConfig: {
          type: 'object',
          properties: {
            read: {
              type: 'array',
              items: { $ref: '#/$defs/rbacRule' },
              minItems: 1
            },
            write: {
              type: 'array',
              items: { $ref: '#/$defs/rbacRule' },
              minItems: 1
            },
            delete: {
              type: 'array',
              items: { $ref: '#/$defs/rbacRule' },
              minItems: 1
            }
          },
          required: ['read', 'write', 'delete'],
          additionalProperties: false
        },
        rbacRule: {
          type: 'object',
          properties: {
            user_role: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
              minLength: 1
            },
            attributes: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^(none|[a-zA-Z_][a-zA-Z0-9_]*)$'
              },
              uniqueItems: true
            }
          },
          required: ['user_role', 'attributes'],
          additionalProperties: false
        }
      }
    };
  }
  
  private static getFieldDefinitionSchema(): JSONSchemaType<FieldDefinition> {
    return this.getSchemaDefinitionSchema().$defs!.fieldDefinition;
  }
  
  private static fieldDefinitionToAjvSchema(fieldDef: FieldDefinition): any {
    const schema: any = {};
    
    switch (fieldDef.type) {
      case 'string':
        schema.type = 'string';
        if (fieldDef.minLength !== undefined) schema.minLength = fieldDef.minLength;
        if (fieldDef.maxLength !== undefined) schema.maxLength = fieldDef.maxLength;
        if (fieldDef.pattern) schema.pattern = fieldDef.pattern;
        if (fieldDef.enum) schema.enum = fieldDef.enum;
        if (fieldDef.format) schema.format = fieldDef.format;
        break;
        
      case 'number':
        schema.type = fieldDef.type;
        schema.minimum = fieldDef.min;
        schema.maximum = fieldDef.max;
        break;
        
      case 'boolean':
        schema.type = 'boolean';
        break;
        
      case 'date':
        schema.type = 'string';
        schema.format = 'date-time';
        break;
        
      case 'objectId':
        schema.type = 'string';
        schema.pattern = '^[0-9a-fA-F]{24}$';
        break;
        
      case 'array':
        schema.type = 'array';
        if (fieldDef.minItems !== undefined) schema.minItems = fieldDef.minItems;
        if (fieldDef.maxItems !== undefined) schema.maxItems = fieldDef.maxItems;
        if (fieldDef.uniqueItems) schema.uniqueItems = fieldDef.uniqueItems;
        if (fieldDef.items) schema.items = this.fieldDefinitionToAjvSchema(fieldDef.items);
        break;
        
      case 'object':
        schema.type = 'object';
        if (fieldDef.properties) {
          schema.properties = {};
          for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
            schema.properties[propName] = this.fieldDefinitionToAjvSchema(propDef);
          }
        }
        break;
        
      default:
        schema.type = 'string';
    }
    
    if (fieldDef.description) {
      schema.description = fieldDef.description;
    }
    
    return schema;
  }
  
  private static performCustomValidations(schema: Schema ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate field definitions with custom logic
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      // Check min/max length consistency for strings
      if (fieldDef.type === 'string' && fieldDef.minLength && fieldDef.maxLength) {
        if (fieldDef.minLength > fieldDef.maxLength) {
          errors.push({
            name: "InvalidLengthRangeError",
            field: fieldName,
            error: 'INVALID_LENGTH_RANGE',
            message: `Field '${fieldName}': maxLength must be greater than or equal to minLength`,
            severity: 'error'
          });
        }
      }
      
      // Check min/max value consistency for numbers
      if ((fieldDef.type === 'number')) {
        const min = fieldDef.min;
        const max = fieldDef.max;
        if (min !== undefined && max !== undefined && min > max) {
          errors.push({
            name: "InvalidRangeError",
            field: fieldName,
            error: 'INVALID_RANGE',
            message: `Field '${fieldName}': min/minimum must be less than or equal to max/maximum`,
            severity: 'error'
          });
        }
      }
      
      // Check array items consistency
      if (fieldDef.type === 'array' && fieldDef.minItems && fieldDef.maxItems) {
        if (fieldDef.minItems > fieldDef.maxItems) {
          errors.push({
            name: "InvalidItemsRangeError",
            field: fieldName,
            error: 'INVALID_ITEMS_RANGE',
            message: `Field '${fieldName}': minItems must be less than or equal to maxItems`,
            severity: 'error'
          });
        }
      }
    }
    
    return errors;
  }
  
  private static performFunctionCustomValidations(schema: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate endpoint format for functions
    if (schema.endpoint && !schema.endpoint.startsWith('/functions/')) {
      errors.push({
        name: "InvalidEndpointError",
        field: 'endpoint',
        error: 'INVALID_ENDPOINT_FORMAT',
        message: `Function endpoint '${schema.endpoint}' should start with '/functions/'`,
        severity: 'warning'
      });
    }
    
    // Validate step dependencies
    if (schema.steps && Array.isArray(schema.steps)) {
      const stepIds = new Set(schema.steps.map((step: any) => step.id));
      
      // Also collect nested step IDs from conditional branches
      const collectNestedStepIds = (step: any): string[] => {
        const nestedIds: string[] = [];
        
        if (step.then && step.then.id) {
          nestedIds.push(step.then.id);
        }
        
        if (step.else && Array.isArray(step.else)) {
          for (const elseStep of step.else) {
            if (elseStep.id) {
              nestedIds.push(elseStep.id);
            }
          }
        }
        
        return nestedIds;
      };
      
      // Add nested step IDs to the main set
      for (const step of schema.steps) {
        if (step.type === 'conditional') {
          const nestedIds = collectNestedStepIds(step);
          nestedIds.forEach(id => stepIds.add(id));
        }
      }
      
      for (const step of schema.steps) {
        // Check for template references to other steps
        const stepStr = JSON.stringify(step);
        const stepReferences = stepStr.match(/\{\{steps\.([^.}]+)\./g);
        
        if (stepReferences) {
          for (const ref of stepReferences) {
            const referencedStepId = ref.match(/\{\{steps\.([^.}]+)\./)?.[1];
            if (referencedStepId && !stepIds.has(referencedStepId)) {
              errors.push({
                name: "InvalidStepReferenceError",
                field: `steps.${step.id}`,
                error: 'INVALID_STEP_REFERENCE',
                message: `Step '${step.id}' references non-existent step '${referencedStepId}'`,
                severity: 'error'
              });
            }
          }
        }
        
        // Validate transform steps have script
        if (step.type === 'transform' && !step.script) {
          errors.push({
            name: "MissingTransformScriptError",
            field: `steps.${step.id}`,
            error: 'MISSING_TRANSFORM_SCRIPT',
            message: `Transform step '${step.id}' must specify a script`,
            severity: 'error'
          });
        }
        
        // Validate aggregate steps have pipeline
        if (step.type === 'aggregate' && (!step.pipeline || !Array.isArray(step.pipeline))) {
          errors.push({
            name: "MissingAggregationPipelineError",
            field: `steps.${step.id}`,
            error: 'MISSING_AGGREGATION_PIPELINE',
            message: `Aggregate step '${step.id}' must have a pipeline array`,
            severity: 'error'
          });
        }
      }
    }
    
    // Validate version format
    if (schema.version && !/^\d+\.\d+\.\d+$/.test(schema.version)) {
      errors.push({
        name: "InvalidVersionFormatError",
        field: 'version',
        error: 'INVALID_VERSION_FORMAT',
        message: `Version '${schema.version}' must follow semantic versioning (x.y.z)`,
        severity: 'error'
      });
    }
    
    return errors;
  }
  
  private static validateFieldTypeSpecific(fieldName: string, fieldDef: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Array fields must have items definition
    if (fieldDef.type === 'array' && !fieldDef.items) {
      errors.push({
        name: "MissingArrayItemsError",
        field: fieldName,
        error: 'MISSING_ARRAY_ITEMS',
        message: `Array field '${fieldName}' must have items definition`,
        severity: 'error'
      });
    }
    
    // Validate regex patterns
    if (fieldDef.pattern) {
      try {
        new RegExp(fieldDef.pattern);
      } catch (e) {
        errors.push({
          name: "InvalidPatternError",
          field: fieldName,
          error: 'INVALID_PATTERN',
          message: `Field '${fieldName}' has invalid regex pattern: ${fieldDef.pattern}`,
          severity: 'error'
        });
      }
    }
    
    return errors;
  }
  
  private static validateRelationshipDefinitions(
    relationships: Record<string, any>, 
    allSchemas: Map<string, Schema>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const [relName, relDef] of Object.entries(relationships)) {
      // Note: foreignField is optional for some relationship types
      // belongsTo typically stores the foreign key in the current collection
      // hasMany/hasOne typically store the foreign key in the related collection
      // manyToMany uses a junction table
      
      // Only require foreignField for belongsTo and hasMany if not specified
      if (relDef.type === 'belongsTo' && !relDef.foreignField) {
        // For belongsTo, we can auto-generate foreignField as ${collection}Id
        // So this is just a warning, not an error
        errors.push({
          name: "MissingForeignKeyError",
          field: relName,
          error: 'MISSING_FOREIGN_KEY',
          message: `belongsTo relationship '${relName}' should specify foreignField (will default to '${relDef.collection}Id')`,
          severity: 'warning'
        });
      }
      
      // Validate junction table for many-to-many
      if (relDef.type === 'manyToMany' && !relDef.through) {
        errors.push({
          name: "MissingJunctionTableError",
          field: relName,
          error: 'MISSING_JUNCTION_TABLE',
          message: `manyToMany relationship '${relName}' must specify through table`,
          severity: 'error'
        });
      }
      
      // Validate referenced collection exists (if schemas provided)
      if (allSchemas.size > 0 && !allSchemas.has(relDef.collection)) {
        errors.push({
          name: "InvalidCollectionReferenceError",
          field: relName,
          error: 'INVALID_COLLECTION_REFERENCE',
          message: `Referenced collection '${relDef.collection}' does not exist`,
          severity: 'error'
        });
      }
    }
    
    return errors;
  }
  
  private static generateValidationSuggestions(schema: any, errors: ValidationError[]): string[] {
    const suggestions: string[] = [];
    const errorTypes = errors.map(e => e.error);
    
    if (errorTypes.includes('MISSING_REQUIRED_PROPERTY')) {
      suggestions.push('Ensure schema has required properties: collection');
    }
    
    if (errorTypes.includes('INVALID_FIELD_TYPE')) {
      suggestions.push('Use supported field types: string, number, boolean, date, objectId, array, object, mixed, buffer, decimal, integer');
    }
    
    if (errorTypes.includes('INVALID_LENGTH_RANGE')) {
      suggestions.push('Ensure maxLength is greater than or equal to minLength for string fields');
    }
    
    if (errorTypes.includes('MISSING_ARRAY_ITEMS')) {
      suggestions.push('Array fields must specify the type of their items');
    }
    
    if (errorTypes.includes('CIRCULAR_DEPENDENCY')) {
      suggestions.push('Review relationship definitions to eliminate circular dependencies');
    }
    
    if (errorTypes.includes('INVALID_PATTERN')) {
      suggestions.push('Check regex patterns for syntax errors');
    }
    
    if (errorTypes.includes('MISSING_FOREIGN_KEY')) {
      suggestions.push('Consider specifying foreignField for relationship definitions for clarity');
    }
    
    if (!schema.fields || Object.keys(schema.fields).length === 0) {
      suggestions.push('Add field definitions to describe the data structure');
    }
    
    return suggestions;
  }
}
