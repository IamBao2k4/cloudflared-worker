import {
  DatabaseType,
  AdapterCapabilities,
  ExecutionOptions,
  AdapterConfig,
  ValidationResult,
} from "../base/types";
import {
  IntermediateQuery,
  IntermediateQueryResult,
} from "../../types/intermediateQuery";
import { RelationshipRegistry } from "../base/relationship/RelationshipRegistry";
// import { EntityManager } from './managers/EntityManager';
import { QueryConverter } from "./converters/QueryConverter";
import { MongoDBQuery } from "./types";
import { Collection, CollectionOptions, Db, Filter, MongoClient } from "mongodb";
import { BaseDatabaseAdapter } from "../base/databaseAdapter";

/**
 * MongoDB adapter for converting intermediate queries to MongoDB aggregation pipelines
 */
export class MongoDBAdapter extends BaseDatabaseAdapter {
  readonly name = "mongodb";
  readonly type: DatabaseType = "mongodb";
  readonly version = "1.0.0";

  private db?: Db; // MongoDB database instance

  private queryConverter: QueryConverter;

  constructor(relationshipRegistry: RelationshipRegistry) {
    super();
    this.queryConverter = new QueryConverter(relationshipRegistry);
  }

  async FindOne(collection: string, options?: CollectionOptions, ) {

    const doc = this.db?.collection(collection, options)
    if (doc) {
      doc.findOne()
    }
  }

  convertQuery(query: IntermediateQuery): MongoDBQuery {
    return this.queryConverter.convertQuery(query);
  }

  /**
   * Execute MongoDB query
   */
  async executeQuery<T = any>(
    collectionName: string,
    intermediateQuery : IntermediateQuery,
    nativeQuery: MongoDBQuery,
    options?: ExecutionOptions
  ): Promise<IntermediateQueryResult<T>> {
    this.ensureInitialized();
    if (!this.db) {
      throw new Error("MongoDB database connection is not available");
    }
    const startTime = Date.now();
    try {
      const collection: Collection = this.db.collection(collectionName);
      let result: any;
      let data: T[] = [];
      if (Array.isArray(nativeQuery)) {
        const cursor = collection.aggregate(nativeQuery);
        data = (await cursor.toArray()) as T[];
      } else if (nativeQuery.operation) {
        // CRUD operations
        switch (nativeQuery.operation) {
          case "insertOne":
            result = await collection.insertOne(nativeQuery.document);
            data = [{ ...nativeQuery.document, _id: result.insertedId }] as T[];
            break;

          case "updateOne":
            result = await collection.updateOne(
              nativeQuery.filter,
              nativeQuery.update
            );
            if (result.modifiedCount > 0) {
              const updated = await collection.findOne(nativeQuery.filter);
              data = updated ? [updated as unknown as T] : [];
            }
            break;

          case "replaceOne":
            result = await collection.replaceOne(
              nativeQuery.filter,
              nativeQuery.update
            );
            if (result.modifiedCount > 0) {
              const replaced = await collection.findOne(nativeQuery.filter);
              data = replaced ? [replaced as unknown as T] : [];
            }
            break;

          case "deleteOne":
            result = await collection.deleteOne(nativeQuery.filter);
            data = [];
            break;

          default:
            throw new Error(`Unsupported operation: ${nativeQuery.operation}`);
        }
      }

      const executionTime = Date.now() - startTime;
      const queryResult = this.createResult(
        data,
        intermediateQuery,
        nativeQuery,
        executionTime
      );
      if (result) {
        queryResult.metadata = {
          ...queryResult.metadata,
          insertedCount: result.insertedCount || 0,
          modifiedCount: result.modifiedCount || 0,
          deletedCount: result.deletedCount || 0,
          matchedCount: result.matchedCount || 0,
        };
      }

      return queryResult;
    } catch (error) {
      throw new Error(
        `MongoDB query execution failed: ${(error as Error).message}`
      );
    }
  }

  getCapabilities(): AdapterCapabilities {
    return {
      filterOperators: [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "in",
        "nin",
        "exists",
        "null",
        "notnull",
        "regex",
        "like",
        "ilike",
        "contains",
        "startswith",
        "endswith",
      ],
      joinTypes: [
        "lookup",
        "left",
        "inner",
        "one-to-one",
        "one-to-many",
        "many-to-one",
        "many-to-many",
      ],
      aggregations: ["count", "sum", "avg", "min", "max", "group", "distinct"],
      fullTextSearch: true,
      transactions: true,
      nestedQueries: true,
      maxComplexity: 100,
      maxResultSize: 1000000,
    };
  }

  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    let connectString: string | undefined;
    let dbName: string | undefined;

    if (config.connection.connectionString) {
      const match = config.connection.connectionString.match(/\/([^/?]+)(\?|$)/);
      connectString = config.connection.connectionString
      if (match) {
        dbName = match[1];
      }
    }else {
      throw new Error("MongoDB connection configuration is required");
    }
    if (!dbName && !connectString) {
      throw new Error("Database name could not be determined from the connection configuration.");
    }
    const client = new MongoClient(connectString);
    await client.connect();
    this.db = client.db(dbName);
    
  }
  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    await super.dispose();
  }
}
