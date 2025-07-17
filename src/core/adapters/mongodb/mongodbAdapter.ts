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
    console.log("MongoDB executeQuery called for collection:", collectionName);
    console.log("Native query:", JSON.stringify(nativeQuery));
    
    const startTime = Date.now();
    try {
      const collection: Collection = this.db.collection(collectionName);
      let result: any;
      let data: T[] = [];
      if (Array.isArray(nativeQuery)) {
        console.log("Executing aggregation query...");
        const cursor = collection.aggregate(nativeQuery);
        data = (await cursor.toArray()) as T[];
        console.log("Aggregation result - data length:", data.length);
        console.log("First item:", data.length > 0 ? JSON.stringify(data[0]) : "No data");
      } else if (nativeQuery.operation) {
        console.log("Executing CRUD operation:", nativeQuery.operation);
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
      console.log("Query execution time:", executionTime, "ms");
      
      const queryResult = this.createResult(
        data,
        intermediateQuery,
        nativeQuery,
        executionTime
      );
      
      console.log("Created query result:", JSON.stringify({
        dataLength: queryResult.data.length,
        hasMetadata: !!queryResult.metadata
      }));
      
      if (result) {
        queryResult.metadata = {
          ...queryResult.metadata,
          insertedCount: result.insertedCount || 0,
          modifiedCount: result.modifiedCount || 0,
          deletedCount: result.deletedCount || 0,
          matchedCount: result.matchedCount || 0,
        };
      }

      console.log("Returning query result with", queryResult.data.length, "items");
      return queryResult;
    } catch (error) {
      console.error("MongoDB query execution error:", error);
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
    console.log("MongoDB adapter initialize() called with config:", JSON.stringify(config));
    await super.initialize(config);
    console.log("MongoDB adapter base initialization complete, isInitialized:", this.isInitialized);
    
    let connectString: string | undefined;
    let dbName: string | undefined;

    if (config.connection.connectionString) {
      const match = config.connection.connectionString.match(/\/([^/?]+)(\?|$)/);
      connectString = config.connection.connectionString
      if (match) {
        dbName = match[1];
      }
      console.log("MongoDB connection details - DB name:", dbName, "Connection string length:", connectString.length);
    }else {
      console.error("MongoDB connection configuration missing");
      throw new Error("MongoDB connection configuration is required");
    }
    if (!dbName && !connectString) {
      console.error("Database name could not be determined");
      throw new Error("Database name could not be determined from the connection configuration.");
    }
    
    try {
      console.log("Creating MongoDB client...");
      const client = new MongoClient(connectString);
      console.log("Connecting to MongoDB...");
      await client.connect();
      console.log("MongoDB client connected successfully");
      this.db = client.db(dbName);
      console.log("MongoDB adapter initialization complete, isInitialized:", this.isInitialized);
    } catch (error) {
      console.error("MongoDB adapter initialization failed:", error);
      this.isInitialized = false;
      throw error;
    }
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
