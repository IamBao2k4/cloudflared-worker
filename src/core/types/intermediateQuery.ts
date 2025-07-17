/**
 * Intermediate JSON format for database-agnostic queries
 * This format can be translated to any database type
 */

export interface IntermediateQuery {
  /** Query type */
  type?: 'read' | 'insert' | 'update' | 'delete';
  
  /** Main collection/table being queried */
  collection: string;
  
  /** Target collection (for joins) */
  target?: string;
  
  /** Filter conditions */
  filter?: FilterCondition;
  
  /** Simple filter array (alternative to filter) */
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  
  /** Data for insert/update operations */
  data?: any;
  
  /** Fields to select/project */
  select?: SelectClause;
  
  /** Sorting configuration */
  sort?: SortClause[];
  
  /** Pagination settings */
  pagination?: PaginationClause;
  
  /** Simple limit (alternative to pagination) */
  limit?: number;
  
  /** Simple skip (alternative to pagination) */
  skip?: number;
  
  /** Join/relationship configurations */
  joins?: JoinClause[];
  
  /** Aggregation operations */
  aggregations?: AggregationClause[];
  
  /** Additional query options */
  options?: {
    partial?: boolean;
    [key: string]: any;
  };
  
  /** Additional metadata */
  metadata?: QueryMetadata;
}

export interface FilterCondition {
  /** Logical operator for combining conditions */
  operator?: 'and' | 'or' | 'not';
  
  /** Field-based conditions */
  conditions?: FieldCondition[];
  
  /** Nested logical conditions */
  nested?: FilterCondition[];
}

export interface FieldCondition {
  /** Field name */
  field: string;
  
  /** Comparison operator */
  operator: ComparisonOperator;
  
  /** Value to compare against */
  value: any;
  
  /** Optional modifiers */
  modifiers?: string[];
}

export type ComparisonOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'like' | 'ilike' | 'regex'
  | 'exists' | 'null' | 'notnull'
  | 'contains' | 'startswith' | 'endswith';

export interface SelectClause {
  /** Fields to include (empty means all) */
  fields?: string[];
  
  /** Fields to exclude */
  exclude?: string[];
  
  /** Field aliases */
  aliases?: Record<string, string>;
  
  /** Computed fields */
  computed?: ComputedField[];
}

export interface ComputedField {
  /** Alias for the computed field */
  alias: string;
  
  /** Expression or function */
  expression: string;
  
  /** Type of computation */
  type: 'function' | 'expression' | 'aggregation';
}

export interface SortClause {
  /** Field to sort by */
  field: string;
  
  /** Sort direction */
  direction: 'asc' | 'desc';
  
  /** Null handling */
  nulls?: 'first' | 'last';
}

export interface PaginationClause {
  /** Number of records to skip */
  offset?: number;
  
  /** Maximum number of records to return */
  limit?: number;
  
  /** Whether to include total count */
  count?: boolean;
}

export interface JoinClause {
  /** Type of join */
  type: JoinType;
  
  /** Target collection/table */
  target: string;
  
  /** Join alias */
  alias?: string;
  
  /** Join conditions */
  on: JoinCondition[];
  
  /** Fields to select from joined table */
  select?: SelectClause;
  
  /** Filters specific to joined table */
  filter?: FilterCondition;
  
  /** Nested joins */
  joins?: JoinClause[];
  
  /** Relationship metadata */
  relationship?: RelationshipMeta;
}

export type JoinType = 
  | 'inner' | 'left' | 'right' | 'full'
  | 'lookup' | 'embed' | 'many-to-one' 
  | 'one-to-many' | 'many-to-many' | 'one-to-one';

export interface JoinCondition {
  /** Local field */
  local: string;
  
  /** Foreign field */
  foreign: string;
  
  /** Comparison operator */
  operator?: ComparisonOperator;
}

export interface RelationshipMeta {
  /** Relationship name */
  name: string;
  
  /** Junction table for many-to-many */
  junction?: {
    table: string;
    local: string;
    foreign: string;
  };
  
  /** Whether to preserve null/empty results */
  preserveNull?: boolean;
}

export interface AggregationClause {
  /** Type of aggregation */
  type: AggregationType;
  
  /** Field to aggregate */
  field?: string;
  
  /** Alias for result */
  alias: string;
  
  /** Additional parameters */
  params?: Record<string, any>;
}

export type AggregationType = 
  | 'count' | 'sum' | 'avg' | 'min' | 'max'
  | 'group' | 'having' | 'distinct';

export interface QueryMetadata {
  /** Original query parameters */
  originalParams?: Record<string, any>;
  
  /** User roles for RBAC */
  roles?: string[];
  
  /** Query source/context */
  source?: string;
  
  /** Timestamp */
  timestamp?: Date;
  
  /** Performance hints */
  hints?: Record<string, any>;
  
  /** Database type */
  database?: string;
  
  /** User information */
  user?: {
    roles: string[];
  };
}

/**
 * Result format for intermediate queries
 */
export interface IntermediateQueryResult<T = any> {
  /** Query data */
  data: T[];
  
  /** Total count (if requested) */
  count?: number;
  
  /** Query metadata */
  metadata: {
    /** Execution time in ms */
    executionTime?: number;
    
    /** Database type used */
    adapter: string;
    
    /** Original intermediate query */
    query: IntermediateQuery;
    
    /** Generated native query */
    nativeQuery?: any;
    
    /** Number of documents inserted */
    insertedCount?: number;
    
    /** Number of documents modified */
    modifiedCount?: number;
    
    /** Number of documents deleted */
    deletedCount?: number;
    
    /** Number of documents matched */
    matchedCount?: number;
  };
  
  /** Pagination info */
  pagination?: {
    offset: number;
    limit: number;
    total?: number;
    hasMore?: boolean;
  };
}