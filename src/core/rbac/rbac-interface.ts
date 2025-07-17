export interface EntitiesSchema{
  documents: CollectionSchema[];
  [fieldName: string]: any;
}

export interface CollectionSchema {
  mongodb_collection_name: string;
  json_schema: JsonSchema;
  permission: RbacPermission;
}

export interface JsonSchema{
  type: string;
  properties: Property;
  required?: string[];
  [key: string]: any;
}

export interface Property {
  type: string;
  description?: string;
  enum?: string[];
  pattern?: string;
  format?: string;
  items?: Property;
  properties?: { [key: string]: Property };
  additionalProperties?: boolean | Property;
  [key: string]: any;
}

export interface RbacPermission {
  default?: RbacActionPattern[];
  user?: RbacActionPattern[];
  admin?: RbacActionPattern[];
  [roleName: string]: RbacActionPattern[] | undefined;
}

export interface RbacActionPattern {
  // in allow_method
  action: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  list_field: string;
  custom_field?: RbacCustomField[];
}

export interface RbacCustomField {
  field: string;
  relation?: string;
  pattern?: string;
  enum?: string[];
  validation?: string;
  function?: string;
  [customName: string]: string | string[] | undefined;
}