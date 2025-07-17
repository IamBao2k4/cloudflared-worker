/**
 * Types for Schema Resolution System
 */

export interface Relationship {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany';
  collection: string;
  foreignKey?: string;
  localKey?: string;
  through?: string;
  throughForeignKey?: string;
  throughLocalKey?: string;
  as?: string;
  constraints?: {
    cascade?: 'delete' | 'update' | 'setNull' | 'restrict';
    required?: boolean;
  };
}

export interface PopulateOptions {
  select?: string | string[];
  match?: any;
  limit?: number;
  skip?: number;
  sort?: any;
  populate?: PopulateOptions | PopulateOptions[];
  maxDepth?: number;
}

export interface RelationshipMap {
  [collectionName: string]: {
    [relationshipName: string]: Relationship;
  };
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{
    from: string;
    to: string;
    relationship: string;
  }>;
  cycles?: string[][];
}

export interface CascadeOperation {
  operation: 'delete' | 'update';
  collection: string;
  documentId: string;
  affectedCollections: Array<{
    collection: string;
    action: 'delete' | 'update' | 'setNull';
    documents: string[];
  }>;
}

export interface ReferenceCount {
  collection: string;
  documentId: string;
  count: number;
  lastUpdated: Date;
}

export interface QueryPlan {
  collection: string;
  query: any;
  projections?: any;
  populations: Array<{
    field: string;
    collection: string;
    strategy: 'lookup' | 'populate' | 'batch';
    estimatedCost: number;
  }>;
  estimatedTotalCost: number;
  recommendations?: string[];
}

export interface SchemaInheritance {
  base?: string;
  mixins?: string[];
  overrides?: {
    [field: string]: any;
  };
}

export interface RelationshipConstraintViolation {
  type: 'referenceNotFound' | 'cardinalityViolation' | 'cascadeRestricted';
  relationship: string;
  value: any;
  message: string;
}
