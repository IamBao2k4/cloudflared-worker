export interface TransformationRule {
  field: string;
  transformer: (value: any, data?: any) => any;
  condition?: (value: any, data?: any) => boolean;
  priority?: number;
}

export interface FieldMapping {
  [internalName: string]: string; // public name
}

export interface ValueTransformation {
  [fieldName: string]: {
    [inputValue: string]: any;
  };
}

export interface FormatRules {
  dates?: string;
  numbers?: string;
  currency?: string;
  locale?: string;
}

export interface SerializationRules {
  includeFields?: string[];
  excludeFields?: string[];
  fieldMappings?: FieldMapping;
  valueTransforms?: ValueTransformation;
  formatRules?: FormatRules;
  conditional?: {
    [field: string]: (value: any, document: any) => boolean;
  };
}

export interface DeserializationRules {
  fieldMappings?: FieldMapping;
  typeConversions?: {
    [field: string]: 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';
  };
  dateFormats?: string[];
  strictMode?: boolean;
}

export interface ApiResponseFormat {
  data: any;
  metadata?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    totalCount?: number;
    requestId?: string;
    timestamp?: string;
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
  errors?: any[];
}

export interface TransformationContext {
  operation: 'input' | 'output' | 'serialize' | 'deserialize';
  format: string;
  locale?: string;
  user?: any;
  requestContext?: any;
}

export interface FieldTransformation {
  field: string;
  transformations: Array<{
    type: string;
    params?: any;
    condition?: (value: any, context: TransformationContext) => boolean;
  }>;
}

export interface TransformationError extends Error {
  field?: string;
  originalValue?: any;
  transformationType?: string;
}
