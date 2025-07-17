// Core Schema Type Definitions
export * from './validation';
export * from './transformation';
export * from './relationship';

// Schema Type Definitions
export interface Schema {
  type: string;
  name?: string;
  collection?: string;
  fields: Record<string, FieldDefinition>;
  relationships?: Record<string, Relationship>;
  indexes?: IndexDefinition[];
  access?: AccessControl;
  timestamps?: boolean;
  softDelete?: boolean;
  hooks?: SchemaHooks;
  options?: SchemaOptions;
}

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  default?: any;
  unique?: boolean;
  index?: boolean;
  
  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  format?: 'email' | 'url' | 'uuid' | 'phone';
  lowercase?: boolean;
  uppercase?: boolean;
  trim?: boolean;
  
  // Number constraints
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  
  // Array constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  items?: FieldDefinition;
  
  // Object constraints
  properties?: Record<string, FieldDefinition>;
  
  // Validation
  validators?: CustomValidator[];
  
  // Access control
  access?: FieldAccess;
  
  // Description
  description?: string;
  example?: any;
}

export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'objectId' 
  | 'array' 
  | 'object' 
  | 'mixed' 
  | 'buffer' 
  | 'decimal';

export interface Relationship {
  type: RelationshipType;
  collection: string;
  foreignKey?: string;
  localKey?: string;
  through?: string;
  cascade?: CascadeRule[];
  populate?: PopulateOptions;
}

export type RelationshipType = 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany';

export type CascadeRule = 'delete' | 'update' | 'setNull' | 'restrict';

export interface PopulateOptions {
  select?: string[];
  match?: object;
  limit?: number;
  sort?: object;
  populate?: PopulateOptions[];
}

export interface IndexDefinition {
  name?: string;
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: IndexOptions;
}

export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: object;
}

export interface AccessControl {
  collection?: CollectionAccess;
  fields?: Record<string, FieldAccess>;
  conditions?: AccessCondition[];
}

export interface CollectionAccess {
  read?: string[];
  write?: string[];
  create?: string[];
  update?: string[];
  delete?: string[];
}

export interface FieldAccess {
  read?: string[];
  write?: string[];
  create?: string[];
  update?: string[];
  conditions?: AccessCondition[];
}

export interface AccessCondition {
  when: string;
  then: AccessRule;
}

export interface AccessRule {
  allow?: string[];
  deny?: string[];
}

export interface CustomValidator {
  validator: (value: any, document?: any) => boolean | string | Promise<boolean | string>;
  message?: string;
  async?: boolean;
  when?: string;
}

export interface SchemaHooks {
  preValidate?: HookFunction[];
  postValidate?: HookFunction[];
  preSave?: HookFunction[];
  postSave?: HookFunction[];
  preDelete?: HookFunction[];
  postDelete?: HookFunction[];
}

export type HookFunction = (document: any, next?: Function) => void | Promise<void>;

export interface SchemaOptions {
  strict?: boolean;
  validateBeforeSave?: boolean;
  autoIndex?: boolean;
  minimize?: boolean;
  safe?: boolean;
  bufferCommands?: boolean;
  capped?: boolean | object;
  collection?: string;
  id?: boolean;
  _id?: boolean;
  read?: string;
  shardKey?: object;
  discriminatorKey?: string;
  autoCreate?: boolean;
  selectPopulatedPaths?: boolean;
  skipVersioning?: object;
  transform?: Function;
  typeKey?: string;
  useNestedStrict?: boolean;
  validateModifiedOnly?: boolean;
  versionKey?: string | boolean;
}

// Validation interfaces
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  data?: any;
}

export interface ValidationError {
  field?: string;
  fields?: string[];
  error: string;
  message: string;
  value?: any;
  constraint?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  field?: string;
  warning: string;
  message: string;
  suggestion?: string;
}

// Transformation interfaces
export interface TransformationRules {
  fieldMappings?: Record<string, string>;
  valueTransforms?: Record<string, Record<string, any>>;
  formatRules?: FormatRules;
  conditionalTransforms?: ConditionalTransform[];
}

export interface FormatRules {
  dates?: string;
  numbers?: string;
  currency?: string;
  locale?: string;
}

export interface ConditionalTransform {
  when: string;
  then: FieldTransformation[];
}

export interface FieldTransformation {
  field: string;
  transform: (value: any, document?: any) => any;
  condition?: (value: any, document?: any) => boolean;
}

// Sanitization options
export interface SanitizeOptions {
  removeUnknown?: boolean;
  trim?: boolean;
  escapeHtml?: boolean;
  convertTypes?: boolean;
  applyDefaults?: boolean;
}

// Query optimization
export interface QueryPlan {
  collection: string;
  pipeline?: object[];
  joins?: JoinOperation[];
  indexes?: string[];
  estimated_cost?: number;
  warnings?: string[];
}

export interface JoinOperation {
  type: 'lookup' | 'unwind' | 'match';
  collection: string;
  localField: string;
  foreignField: string;
  as?: string;
}

// Error types
export class SchemaError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'SchemaError';
  }
}

export class ValidationError extends SchemaError {
  constructor(message: string, public field?: string, public value?: any) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class TransformationError extends SchemaError {
  constructor(message: string, public transform?: string) {
    super(message, 'TRANSFORMATION_ERROR');
    this.name = 'TransformationError';
  }
}

export class LoaderError extends SchemaError {
  constructor(message: string, public filePath?: string) {
    super(message, 'LOADER_ERROR');
    this.name = 'LoaderError';
  }
}

export class ResolverError extends SchemaError {
  constructor(message: string, public relationship?: string) {
    super(message, 'RESOLVER_ERROR');
    this.name = 'ResolverError';
  }
}
