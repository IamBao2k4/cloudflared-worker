import { QueryParams } from "../types";
import { QueryConverter } from "../converter/queryConverter";
import {
  IntermediateQuery,
  IntermediateQueryResult,
} from "../types/intermediateQuery";

// import { RbacValidator } from "../rbac/rbac-validator";
import { RelationshipRegistry } from "../adapters/base/relationship/RelationshipRegistry";
import { CoreErrors } from "../errors/errorFactories";
import { ObjectId } from "mongodb"; // Assuming MongoDB is used for ObjectId type
import {
  AdapterRegistry,
  adapterRegistry,
} from "../adapters/base/adapterRegister";
import { DatabaseAdapter, DatabaseType } from "../adapters/base/types";
import { CoreConfig } from "./types";
import { MongoDBAdapter } from "../adapters/mongodb/mongodbAdapter";
import { ElasticsearchAdapter } from "../adapters/elasticsearch/elasticsearchAdapter";
import { MySQLAdapter } from "../adapters/mysql/mysqlAdapter";
import { PostgreSQLAdapter } from "../adapters/postgresql/postgresqlAdapter";
/**
 * New core architecture with clean separation of concerns
 */

export class NewCore {
  private queryConverter: QueryConverter;
  // private rbacValidator: RbacValidator;
  private adapterRegistry: AdapterRegistry;
  private relationshipRegistry: RelationshipRegistry;

  constructor(
    relationshipRegistry: RelationshipRegistry,
    customAdapterRegistry?: AdapterRegistry
  ) {
    this.relationshipRegistry = relationshipRegistry;
    this.queryConverter = new QueryConverter();
    // this.rbacValidator = new RbacValidator();
    this.adapterRegistry = customAdapterRegistry || adapterRegistry;

    // Load RBAC configuration
    // this.rbacValidator.loadConfig();
  }

  async findAll<T = any>(
    params: QueryParams,
    collection: string,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<IntermediateQueryResult<any>> {
    console.log(JSON.stringify(params))
    const result = this.processQuery(
      params,
      collection,
      roles,
      databaseType,
      adapterName
    );
    return result;
  }

  /**
   * Main query processing method
   */
  async processQuery<T = any>(
    params: QueryParams,
    collection: string,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<IntermediateQueryResult<T>> {
    const intermediateQuery = this.queryConverter.convert(
      params,
      collection,
      roles
    );

    // const relation = this.relationshipRegistry.getForTable(collection)
    // if (relation.length > 0) {
    //   relation.forEach((item: any) => {
    //     intermediateQuery.select += `,${item.name}()`
    //   })
    // }

    // 3. Enhance query with relationship data
    this.enhanceQueryWithRelationships(intermediateQuery);

    // 4. Apply RBAC field restrictions

    // 5. Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);


    // 6. Validate query against adapter capabilities
    const validation = adapter.validateQuery(intermediateQuery);
    if (!validation.valid) {
      throw CoreErrors.queryValidationFailed(validation.errors);
    }

    // 7. Convert to native database query
    const nativeQuery = adapter.convertQuery(intermediateQuery);

    console.log("Executing query:", JSON.stringify(nativeQuery));
    return adapter.executeQuery<T>(collection, intermediateQuery, nativeQuery);
  }

  /**
   * Get list of supported database types
   */
  getSupportedDatabaseTypes(): DatabaseType[] {
    return this.adapterRegistry.getSupportedTypes();
  }

  /**
   * Get adapter information
   */
  public getAdapterInfo(databaseType?: DatabaseType) {
    if (databaseType) {
      return this.adapterRegistry.listAdaptersByType(databaseType);
    }
    return this.adapterRegistry.listAdapters();
  }

  /**
   * Test adapter connection
   */
  async testConnection(
    databaseType: DatabaseType,
    adapterName?: string
  ): Promise<boolean> {
    const adapter = this.getAdapter(databaseType, adapterName);
    return adapter.testConnection();
  }

  /**
   * Initialize core with configuration
   */
  async initialize(config: CoreConfig): Promise<void> {
    if (config.adapters) {
      await this.adapterRegistry.initializeAll(
        config.adapters,
        this.relationshipRegistry
      );
    }
  }

  /**
   * Dispose of core resources
   */
  async dispose(): Promise<void> {
    await this.adapterRegistry.disposeAll();
  }

  /**
   * Get database adapter
   */
  public getAdapter(
    databaseType: DatabaseType,
    adapterName?: string
  ): DatabaseAdapter {
    const adapter = this.adapterRegistry.getAdapterByType(
      databaseType,
      adapterName
    );

    if (!adapter) {
      throw CoreErrors.adapterNotFound(databaseType, adapterName);
    }

    switch (databaseType) {
      case "mongodb":
        return adapter as MongoDBAdapter;
      case "elasticsearch":
        return adapter as ElasticsearchAdapter;
      case "mysql":
        return adapter as MySQLAdapter;
      case "postgresql":
        return adapter as PostgreSQLAdapter;
      default:
        return adapter;
    }
  }

  /**
   * Enhance query with relationship information
   */
  public enhanceQueryWithRelationships(query: IntermediateQuery): void {
    if (!this.relationshipRegistry || !query.joins) return;
    this.enhanceJoinsRecursively(query.joins, query.collection);
  }

  /**
   * Recursively enhance joins with relationship information
   */
  private enhanceJoinsRecursively(
    joins: any[],
    sourceCollection: string
  ): void {
    if (!this.relationshipRegistry) {
      throw CoreErrors.relationshipNotInitialized();
    }

    if (!Array.isArray(joins)) {
      throw CoreErrors.joinsInvalidType();
    }

    joins.forEach((join) => {
      if (join.relationship && !join.on.length) {
        // Populate join conditions from relationship registry
        const relationships =
          this.relationshipRegistry!.getRelationships(sourceCollection);

        if (!Array.isArray(relationships)) {
          throw CoreErrors.relationshipNotFound(sourceCollection);
        }

        const relationship = relationships.find(
          (rel) => rel.name === join.relationship!.name
        );

        if (relationship) {
          join.on = [
            {
              local: relationship.localField,
              foreign: relationship.foreignField,
              operator: "eq",
            },
          ];

          // Update target to use actual target table
          join.target = relationship.targetTable;

          // Set join type based on relationship type
          if (relationship.type === "one-to-one") {
            join.type = "one-to-one";
          } else if (relationship.type === "one-to-many") {
            join.type = "one-to-many";
          } else if (relationship.type === "many-to-one") {
            join.type = "many-to-one";
          } else if (relationship.type === "many-to-many") {
            join.type = "many-to-many";
            join.relationship!.junction = relationship.junction;
          }
        }
      }

      // Recursively enhance nested joins
      if (join.joins && join.joins.length > 0) {
        this.enhanceJoinsRecursively(join.joins, join.target);
      }
    });
  }

  /**
   * Register a new database adapter
   */
  registerAdapter(adapter: DatabaseAdapter): void {
    this.adapterRegistry.register(adapter);
  }

  /**
   * Unregister a database adapter
   */
  unregisterAdapter(name: string, version?: string): boolean {
    return this.adapterRegistry.unregister(name, version);
  }

  /**
   * Create a new resource
   */
  async create<T = any>(
    collection: string,
    data: any,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<T> {
    // Validate RBAC access
    // if (!this.rbacValidator.hasAccess(collection, "create", roles)) {
    //   throw CoreErrors.accessDeniedCreate(collection, roles);
    // }
    // Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);

    // Create intermediate query for insert operation
    const intermediateQuery: IntermediateQuery = {
      type: "insert",
      collection,
      data,
      target: collection,
      filters: [],
      metadata: {
        database: databaseType,
        timestamp: new Date(),
        user: {
          roles,
        },
      },
    };

    // Apply RBAC field restrictions
    this.applyRbacRestrictions(intermediateQuery, collection, roles);

    // Execute the insert
    const result = await adapter.executeQuery<T>(
      collection,
      intermediateQuery,
      adapter.convertQuery(intermediateQuery)
    );

    return result.data[0];
  }

  /**
   * Update a resource by ID
   */
  async update<T = any>(
    collection: string,
    id: string,
    data: any,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<T> {
    // Validate RBAC access
    // if (!this.rbacValidator.hasAccess(collection, "update", roles)) {
    //   throw CoreErrors.accessDeniedUpdate(collection, roles);
    // }

    // Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);

    // Create intermediate query for update operation
    const intermediateQuery: IntermediateQuery = {
      type: "update",
      collection,
      data,
      target: collection,
      filters: [
        {
          field: "_id",
          operator: "eq",
          value: id,
        },
      ],
      metadata: {
        database: databaseType,
        timestamp: new Date(),
        user: {
          roles,
        },
      },
    };

    // Apply RBAC field restrictions
    this.applyRbacRestrictions(intermediateQuery, collection, roles);

    // Execute the update
    const result = await adapter.executeQuery<T>(
      collection,
      intermediateQuery,
      adapter.convertQuery(intermediateQuery)
    );

    if (!result.data || result.data.length === 0) {
      throw CoreErrors.resourceNotFound(collection, id);
    }

    return result.data[0];
  }

  /**
   * Partial update a resource by ID
   */
  async partialUpdate<T = any>(
    collection: string,
    id: string,
    data: any,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<T> {
    // Validate RBAC access
    // if (!this.rbacValidator.hasAccess(collection, "update", roles)) {
    //   throw CoreErrors.accessDeniedUpdate(collection, roles);
    // }

    // Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);

    // Create intermediate query for partial update operation
    const intermediateQuery: IntermediateQuery = {
      type: "update",
      collection,
      data,
      target: collection,
      filters: [
        {
          field: "_id",
          operator: "eq",
          value: id,
        },
      ],
      options: {
        partial: true,
      },
      metadata: {
        database: databaseType,
        timestamp: new Date(),
        user: {
          roles,
        },
      },
    };

    // Apply RBAC field restrictions
    this.applyRbacRestrictions(intermediateQuery, collection, roles);

    // Execute the partial update
    const result = await adapter.executeQuery<T>(
      collection,
      intermediateQuery,
      adapter.convertQuery(intermediateQuery)
    );

    if (!result.data || result.data.length === 0) {
      throw CoreErrors.resourceNotFound(collection, id);
    }

    return result.data[0];
  }

  /**
   * Delete a resource by ID
   */
  async delete(
    collection: string,
    id: string,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<boolean> {
    // Validate RBAC access
    // if (!this.rbacValidator.hasAccess(collection, "delete", roles)) {
    //   throw CoreErrors.accessDeniedDelete(collection, roles);
    // }

    // Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);

    // Create intermediate query for delete operation
    const intermediateQuery: IntermediateQuery = {
      type: "delete",
      collection,
      target: collection,
      filters: [
        {
          field: "_id",
          operator: "eq",
          value: id,
        },
      ],
      metadata: {
        database: databaseType,
        timestamp: new Date(),
        user: {
          roles,
        },
      },
    };
    // Execute the delete
    const result = await adapter.executeQuery(
      collection,
      intermediateQuery,
      adapter.convertQuery(intermediateQuery)
    );

    return (result.metadata?.deletedCount ?? 0) > 0;
  }

  /**
   * Find a resource by ID
   */
  async findById<T = any>(
    collection: string,
    params: QueryParams,
    id: string,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<IntermediateQueryResult<T> | null> {
    // Validate RBAC access
    // if (!this.rbacValidator.hasAccess(collection, "read", roles)) {
    //   throw CoreErrors.accessDeniedRead(collection, roles);
    // }
    const intermediateQuery = this.queryConverter.convert(
      params,
      collection,
      roles
    );
    intermediateQuery.type = "read"
    if (!intermediateQuery.filters) {
      intermediateQuery.filters = []
    }
    intermediateQuery.filters?.push({
      field: "_id",
      operator: "eq",
      value: new ObjectId(id)
    })
    intermediateQuery.limit = 1
    this.enhanceQueryWithRelationships(intermediateQuery);
    
    // Get appropriate database adapter
    const adapter = this.getAdapter(databaseType, adapterName);
    // Create intermediate query for finding by ID
    // const intermediateQuery: IntermediateQuery = {
    //   type: "read",
    //   collection,
    //   target: collection,
    //   filters: [
    //     {
    //       field: "_id",
    //       operator: "eq",
    //       value: new ObjectId(id),
    //     },
    //   ],
    //   limit: 1,
    //   metadata: {
    //     database: databaseType,
    //     timestamp: new Date(),
    //     user: {
    //       roles,
    //     },
    //   },
    // };
    const query = adapter.convertQuery(intermediateQuery)
    console.log(query)
    // Execute the query
    const result = await adapter.executeQuery<T>(
      collection,
      intermediateQuery,
      query
    );

    return result.data && result.data.length > 0 ? result : null;
  }

  async findOne<T = any>(
    collection: string,
    query: any,
    roles: string[],
    databaseType: DatabaseType = "mongodb",
    adapterName?: string
  ): Promise<T | null> {
    const adapter = this.getAdapter(databaseType, adapterName);
    return null;
  }

  private applyRbacRestrictions(
    query: IntermediateQuery,
    collection: string,
    roles: string[],
    action: string = "read"
  ): void {
    if (!query) {
      throw CoreErrors.queryObjectRequired();
    }

    if (!collection || typeof collection !== "string") {
      throw CoreErrors.collectionNameInvalid();
    }

    if (!Array.isArray(roles)) {
      throw CoreErrors.rolesInvalidType();
    }
    if (!query.select) {
      query.select = { fields: [] };
    }
    // const rbacValidator = new RbacValidator();
    // query.select.fields = rbacValidator.filterRbacFeatures(
    //   collection,
    //   action,
    //   roles,
    //   query.select.fields
    // );
  }
}
