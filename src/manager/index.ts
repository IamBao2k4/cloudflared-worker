import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";
import { EntitiesData, EntityConfig, IEntityManager } from "./types";
import { RelationshipRegistry } from "../core/adapters/base/relationship/RelationshipRegistry";
import { RelationshipDefinition } from "../core/adapters/base/relationship/types";

export class EntityManager implements IEntityManager {
  private ajv: Ajv;
  private entitiesCache: EntitiesData | null = null;
  private entitiesFilePath: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private relationshipRegistry: RelationshipRegistry;

  constructor(
    relationshipRegistry: RelationshipRegistry,
    entitiesFilePath?: string
  ) {
    this.ajv = new Ajv({
  strict: true,
  allowUnionTypes: true,
});
    this.entitiesFilePath =
      entitiesFilePath ||
      path.join(process.cwd(), "json/entities", "_entities.json");
    this.relationshipRegistry =
      relationshipRegistry
    this.initializeEntityCache();
  }

  private initializeEntityCache(): void {
    this.loadEntitiesFromFile();
    this.initFileWatcher();
  }

  private initFileWatcher(): void {
    if (fs.existsSync(this.entitiesFilePath)) {
      this.fileWatcher = fs.watch(this.entitiesFilePath, (eventType) => {
        if (eventType === "change") {
          this.loadEntitiesFromFile();
        }
      });
    } else {
      console.warn(
        `[EntityManager] Entities file not found: ${this.entitiesFilePath}`
      );
    }
  }

  private loadEntitiesFromFile(): void {
    try {
      if (!fs.existsSync(this.entitiesFilePath)) {
        console.warn(`[EntityManager] File ${this.entitiesFilePath} not found`);
        this.entitiesCache = null;
        return;
      }

      const data = fs.readFileSync(this.entitiesFilePath, "utf8");
      const entities = JSON.parse(data) as EntitiesData;

      const schema = {
        type: "object",
        properties: {
          documents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: ["string", "object"] },
                title: { type: "string" },
                collection_name: { type: "string" },
                mongodb_collection_name: { type: "string" },
                unique_key: { type: "string" },
                use_parent: { type: "boolean" },
                use_parent_delete_childs: { type: "boolean" },
                json_schema: { type: "object" },
                ui_schema: { type: "object" },
              },
              // required: ["title"],
              // anyOf: [
              // ],
            },
          },
        },
        required: ["documents"],
      };

      const validate = this.ajv.compile(schema);
      const valid = validate(entities);

      if (!valid) {
        console.error(
          "[EntityManager] Invalid entities JSON structure:",
          validate.errors
        );
        throw new Error(
          `Invalid entities JSON structure: ${JSON.stringify(validate.errors)}`
        );
      }

      this.entitiesCache = entities;

      // Parse and register relationships
      this.parseAndRegisterRelationships(entities);
    } catch (error) {
      console.error("[EntityManager] Error loading entities file:", error);
      this.entitiesCache = null;
    }
  }

  /**
   * Get entity by collection name
   */
  getEntityByCollectionName(collectionName: string): EntityConfig | undefined {
    if (!this.entitiesCache) {
      return undefined;
    }

    return this.entitiesCache.documents.find(
      (entity) =>
        (entity.mongodb_collection_name || entity.collection_name) ===
        collectionName
    );
  }

  /**
   * Get all entities
   */
  getEntities(): EntitiesData | null {
    return this.entitiesCache;
  }

  /**
   * Get all collection names from entities
   */
  getCollectionNames(): string[] {
    if (!this.entitiesCache) {
      return [];
    }

    return this.entitiesCache.documents
      .map(
        (entity) =>
          entity.mongodb_collection_name || entity.collection_name || ""
      )
      .filter((name) => name);
  }

  /**
   * Check if collection is allowed
   */
  isCollectionAllowed(collectionName: string): boolean {
    // Special cases
    if (collectionName === "entity" || collectionName === "_entities") {
      return true;
    }

    if (!this.entitiesCache || !this.entitiesCache.documents) {
      console.warn(
        "[EntityManager] No entities loaded, rejecting collection access"
      );
      return false;
    }

    return this.entitiesCache.documents.some(
      (entity) =>
        (entity.mongodb_collection_name || entity.collection_name) ===
        collectionName
    );
  }

  /**
   * Parse and register relationships from entities
   */
  public async parseAndRegisterRelationships(
    entities: EntitiesData
  ): Promise<void> {
    // Clear existing relationships
    this.relationshipRegistry.clear();

    for (const entity of entities.documents) {
      const collectionName =
        entity.mongodb_collection_name || entity.collection_name;
      if (!collectionName || !entity.json_schema) continue;

      const relationships = this.parseRelationshipsFromSchema(
        entity.json_schema,
        collectionName
      );

      // Register relationships
      relationships.forEach((rel) => {
        this.relationshipRegistry.registerFromDefinition(collectionName, rel);
      });

      if (relationships.length > 0) {
        const relationshipsFilePath = path.join(
          process.cwd(),
          "relationship",
          `${collectionName}.json`
        );
        const jsonData = JSON.stringify(relationships, null, 2);

        try {
          await fs.promises.mkdir(path.dirname(relationshipsFilePath), {
            recursive: true,
          });
          await fs.promises.writeFile(relationshipsFilePath, jsonData, {
            encoding: "utf8",
          });
        } catch (err) {
          console.error(
            `Lỗi khi ghi relationships cho ${collectionName}:`,
            err
          );
        }
      }
    }
  }

  /**
   * Parse relationships from JSON schema
   */
  private parseRelationshipsFromSchema(
    schema: any,
    sourceCollection: string,
    parentPath: string = ""
  ): RelationshipDefinition[] {
    const relationships: RelationshipDefinition[] = [];

    if (!schema.properties) {
      return relationships;
    }

    Object.entries(schema.properties).forEach(
      ([fieldName, fieldDef]: [string, any]) => {
        const currentPath = parentPath
          ? `${parentPath}.${fieldName}`
          : fieldName;

        // Check for typeRelation (for all field types, not just non-objects)
        if (fieldDef.typeRelation) {
          const relation = fieldDef.typeRelation;

          // Convert relationship type format
          const relType = this.convertRelationType(relation.type);

          // Handle case where typeRelation only has title but no _id
          // Also handle "id" field (some use "id" instead of "_id")
          // Also handle "entity" field (some use "entity" for target)
          const targetTable =
            relation._id ||
            relation.id ||
            relation.collection ||
            relation.entity ||
            relation.title;

          const relationship: RelationshipDefinition = {
            name: currentPath,
            targetTable: targetTable,
            localField: currentPath,
            foreignField: relation.foreignField || "_id",
            type: relType,
          };

          // Handle many-to-many with junction table
          if (relType === "many-to-many" && relation.junction) {
            relationship.junction = {
              table: relation.junction.table,
              localKey: relation.junction.localKey || `${sourceCollection}_id`,
              foreignKey: relation.junction.foreignKey || `${relation._id}_id`,
            };
          }

          relationships.push(relationship);
        }

        // Handle nested objects - parse properties inside objects
        // This will find relationships in nested properties even if the object itself has a typeRelation
        if (fieldDef.type === "object" && fieldDef.properties) {
          const nestedRelations = this.parseRelationshipsFromSchema(
            fieldDef,
            sourceCollection,
            currentPath
          );
          relationships.push(...nestedRelations);
        }

        // Handle array of objects
        if (
          fieldDef.type === "array" &&
          fieldDef.items &&
          fieldDef.items.properties
        ) {
          const arrayRelations = this.parseRelationshipsFromSchema(
            fieldDef.items,
            sourceCollection,
            `${currentPath}[]`
          );
          relationships.push(...arrayRelations);
        }
      }
    );

    return relationships;
  }

  /**
   * Convert relationship type from schema format to standard format
   */
  private convertRelationType(
    type: string
  ): "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" {
    if (!type) {
      console.warn(
        "[EntityManager] Relationship type is undefined, defaulting to one-to-many"
      );
      return "one-to-many";
    }
    const normalized = type.toLowerCase().replace(/\s+/g, "");

    switch (normalized) {
      case "1-1":
      case "onetoone":
      case "one-to-one":
        return "one-to-one";

      case "1-n":
      case "1-*":
      case "onetomany":
      case "one-to-many":
        return "one-to-many";

      case "n-1":
      case "*-1":
      case "manytoone":
      case "many-to-one":
        return "many-to-one";

      case "n-n":
      case "*-*":
      case "n-*":
      case "*-n":
      case "manytomany":
      case "many-to-many":
        return "many-to-many";

      default:
        console.warn(
          `[EntityManager] Unknown relationship type: ${type}, defaulting to one-to-many`
        );
        return "one-to-many";
    }
  }
  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Close file watcher
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    // Clear cache
    this.entitiesCache = null;

    // Clear relationships
    this.relationshipRegistry.clear();
  }
}
