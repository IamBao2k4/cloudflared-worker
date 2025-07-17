export interface ValidationError {
  field?: string;
  fields?: string[];
  error: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  constraint?: string;
  params?: any[];
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  value?: any;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  convert?: boolean;
  context?: any;
}

export interface FieldValidationResult {
  field: string;
  valid: boolean;
  errors?: ValidationError[];
  value?: any;
}

export interface CrossFieldValidationRule {
  fields: string[];
  validator: (data: any) => boolean | string;
  message?: string;
}

export interface UniqueConstraint {
  field: string;
  collection: string;
  excludeId?: string;
  compound?: string[];
}

export interface AsyncValidationConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: any;
  timeout?: number;
}

export interface CustomValidator {
  validator: (value: any, document?: any) => boolean | string | Promise<boolean | string>;
  message?: string;
  async?: boolean;
  config?: any;
}

export interface SanitizeOptions {
  trim?: boolean;
  removeUnknown?: boolean;
  escapeHtml?: boolean;
  convertTypes?: boolean;
}

export interface ValidationSummary {
  valid: boolean;
  errorCount: number;
  fieldErrors: Record<string, ValidationError[]>;
  crossFieldErrors: ValidationError[];
  criticalErrors: ValidationError[];
  warnings: ValidationError[];
}
