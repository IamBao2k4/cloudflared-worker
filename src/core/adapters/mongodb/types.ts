import { Db, MongoClient, Collection } from 'mongodb';
import { 
  DatabaseAdapter,
  DatabaseType,
  AdapterCapabilities,
  ExecutionOptions,
  AdapterConfig,
  ValidationResult
} from '../base/types';
import { 
  IntermediateQuery, 
  IntermediateQueryResult
} from '../../types/intermediateQuery';
import { RelationshipRegistry } from '../base/relationship/RelationshipRegistry';

export interface EntityConfig {
  _id?: string;
  title: string;
  mongodb_collection_name?: string;
  collection_name?: string; // For backward compatibility
  unique_key?: string;
  use_parent?: boolean;
  use_parent_delete_childs?: boolean;
  json_schema?: any;
  ui_schema?: any;
}

export interface EntitiesData {
  documents: EntityConfig[];
}

export interface MongoDBOperation {
  operation: 'insertOne' | 'updateOne' | 'replaceOne' | 'deleteOne';
  document?: any;
  filter?: any;
  update?: any;
}

export type MongoDBQuery = any[] | MongoDBOperation;

