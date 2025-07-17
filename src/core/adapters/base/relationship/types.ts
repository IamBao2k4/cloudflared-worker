export interface JoinCondition {
  localField: string;
  foreignField: string;
  joinType: 'inner' | 'left' | 'right';
}

export interface JoinHint {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  junction?: JunctionConfig;
}

export interface JunctionConfig {
  table: string;
  localKey: string;
  foreignKey: string;
}

export interface RelationshipDefinition {
  name: string;
  targetTable: string;
  localField: string;
  foreignField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  junction?: JunctionConfig;
  inverse?: string; // Tên relationship ngược lại
}

export interface EmbedRequest {
  table: string;
  alias?: string;
  fields: string[];
  filters?: Record<string, any>;
  orderBy?: string[];
  limit?: number;
  offset?: number;
  children?: (EmbedRequest | null)[] 
  joinHint?: string; // inner, left, right
}
