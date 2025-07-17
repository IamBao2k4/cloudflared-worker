import { MongoClient, Db, Collection } from 'mongodb';

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
/**
 * Interface for Entity Management operations
 * Provides a user-friendly API for managing MongoDB entities with schema validation,
 * relationship management, and automatic configuration loading.
 * 
 * @example
 * ```typescript
 * const entityManager: IEntityManager = new EntityManager();
 * await entityManager.initialize(mongoClient, 'myDatabase');
 * 
 * // Get a collection
 * const userCollection = await entityManager.getCollection('users');
 * 
 * // Get entity configuration
 * const userEntity = entityManager.getEntityByCollectionName('users');
 * ```
 */
export interface IEntityManager {

  /**
   * Get entity configuration by collection name
   * Returns undefined if entity not found
   * 
   * @param collectionName - Name of the collection
   * @returns Entity configuration object or undefined
   * 
   * @example
   * ```typescript
   * const userEntity = entityManager.getEntityByCollectionName('users');
   * if (userEntity) {
   *   console.log('User entity schema:', userEntity.json_schema);
   * }
   * ```
   */
  getEntityByCollectionName(collectionName: string): EntityConfig | undefined;

  /**
   * Get all loaded entities configuration
   * Returns null if entities not loaded
   * 
   * @returns All entities data or null
   * 
   * @example
   * ```typescript
   * const entities = entityManager.getEntities();
   * if (entities) {
   *   console.log(`Loaded ${entities.documents.length} entities`);
   * }
   * ```
   */
  getEntities(): EntitiesData | null;

  /**
   * Get all registered collection names from entities
   * 
   * @returns Array of collection names (may be empty if no entities loaded)
   * 
   * @example
   * ```typescript
   * const collectionNames = entityManager.getCollectionNames();
   * collectionNames.forEach(name => console.log(`Collection: ${name}`));
   * ```
   */
  getCollectionNames(): string[];

  /**
   * Check if a collection is allowed/registered
   * Used internally for validation before granting collection access
   * 
   * @param collectionName - Name of the collection to check
   * @returns true if collection is allowed, false otherwise
   * 
   * @example
   * ```typescript
   * if (entityManager.isCollectionAllowed('users')) {
   *   // Safe to access users collection
   * }
   * ```
   */
  isCollectionAllowed(collectionName: string): boolean;

  /**
   * Parse and register relationships from entities configuration
   * Automatically extracts relationship definitions from JSON schemas
   * and registers them with the RelationshipRegistry
   * 
   * @param entities - Entities data containing relationship definitions
   * @returns Promise that resolves when relationships are registered
   * 
   * @example
   * ```typescript
   * const entities = entityManager.getEntities();
   * if (entities) {
   *   await entityManager.parseAndRegisterRelationships(entities);
   * }
   * ```
   */
  parseAndRegisterRelationships(entities: EntitiesData): Promise<void>;

  /**
   * Clean up resources (file watchers, cache, etc.)
   * Should be called when entity manager is no longer needed
   * 
   * @returns Promise that resolves when cleanup is complete
   * 
   * @example
   * ```typescript
   * // On application shutdown
   * await entityManager.dispose();
   * ```
   */
  dispose(): Promise<void>;
}

/**
 * Configuration options for EntityManager constructor
 */
export interface IEntityManagerOptions {
  /**
   * Path to the entities JSON file
   * @default path.join(process.cwd(), 'json/entities', '_entities.json')
   */
  entitiesFilePath?: string;
  
  /**
   * Custom RelationshipRegistry instance
   * @default new RelationshipRegistry()
   */
  relationshipRegistry?: any;
}

/**
 * Collection watch event types
 */
export type WatchEventType = 'insert' | 'update' | 'replace' | 'delete';

/**
 * Entity collection proxy methods
 * Special methods available when accessing the 'entity' collection
 */
export interface IEntityCollectionProxy {
  /**
   * Find one entity by filter criteria
   * @param filter - Must include one of: mongodb_collection_name, collection_name, _id, or id
   * @param options - MongoDB find options
   */
  findOne(filter: { 
    mongodb_collection_name?: string;
    collection_name?: string;
    _id?: string;
    id?: string;
  }, options?: any): Promise<EntityConfig | null>;
  
  /**
   * Find all entities matching filter
   * @param filter - Filter criteria (empty object returns all)
   * @param options - MongoDB find options
   */
  find(filter?: any, options?: any): {
    toArray(): Promise<EntityConfig[]>;
  };
}