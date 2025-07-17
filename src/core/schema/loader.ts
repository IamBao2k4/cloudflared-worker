import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { watch } from 'chokidar';
import { Schema, LoaderError, ValidationResult } from './types';
import { SchemaValidator } from './schema-validator';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * Schema Loader - Load and Process Schema
 * This module is responsible for loading, parsing and validating JSON schema files
 */
export class SchemaLoader {
  private static schemaCache = new Map<string, Schema>();
  private static watchCallbacks = new Map<string, Function[]>();
  private static watchers = new Map<string, any>();

  /**
   * Load schema from JSON file
   */
  static async loadSchema(filePath: string, type: string): Promise<Schema> {
    try {
      // Check cache first
      const cacheKey = path.resolve(filePath);
      if (SchemaLoader.schemaCache.has(cacheKey)) {
        return SchemaLoader.schemaCache.get(cacheKey)!;
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new LoaderError(`Schema file not found: ${filePath}`, filePath);
      }

      // Read and parse JSON
      const fileContent = await readFile(filePath, 'utf8');
      let schema: Schema;

      try {
        schema = JSON.parse(fileContent);
      } catch (parseError: any) {
        throw new LoaderError(
          `Invalid JSON in schema file: ${filePath}. ${parseError.message}`,
          filePath
        );
      }

      // Validate schema structure
      const validation = type === 'collections'
        ? await SchemaLoader.validateSchemaDefinition(schema)
        : type === 'functions'
          ? await SchemaLoader.validateFunctionSchemaDefinition(schema)
          : type === 'rbac'
            ? await SchemaLoader.validateRBACSchemaDefinition(schema)
            : { valid: false, errors: [{ message: `Unknown schema type: ${type}` }] };

      // Check validation result
      if (!validation.valid) {
        const errorMessages = validation.errors?.map(e => e.message).join(', ') || 'Unknown validation errors';
        throw new LoaderError(
          `Schema validation failed for ${filePath}: ${errorMessages}`,
          filePath
        );
      }

      // Cache the schema
      SchemaLoader.schemaCache.set(cacheKey, schema);

      return schema;
    } catch (error: any) {
      if (error instanceof LoaderError) {
        throw error;
      }
      throw new LoaderError(
        `Failed to load schema from ${filePath}: ${error.message}`,
        filePath
      );
    }
  }

  /**
   * Load all schemas from a directory
   */
  static async loadAllSchemas(schemasDir: string, type: string): Promise<Map<string, Schema>> {
    try {
      const schemas = new Map<string, Schema>();
      const collectionNames = new Set<string>();

      // Check if directory exists
      if (!fs.existsSync(schemasDir)) {
        throw new LoaderError(`Schemas directory not found: ${schemasDir}`);
      }

      // Get all JSON files in directory
      const files = await SchemaLoader.getJsonFiles(schemasDir);

      // Load schemas in parallel
      const loadPromises = files.map(async (file) => {
        const filePath = path.join(schemasDir, file);
        try {
          const schema = await SchemaLoader.loadSchema(filePath, type);

          // Check for duplicate collection names or function names
          if (type === "collections" && !schema.collection) {
            throw new LoaderError(`Schema file ${file} does not define a collection name`, filePath);
          }
          if (type === "functions" && !schema.name) {
            throw new LoaderError(`Schema file ${file} does not define a function name`, filePath);
          }
          if (type === "rbac" && !schema.name) {
            throw new LoaderError(`Schema file ${file} does not define an RBAC name`, filePath);
          }

          // Determine the schema key based on type
          let schemaKey: string;
          if (type === "collections" && schema.collection) {
            schemaKey = schema.collection;
          } else {
            if (schema.name) {
              schemaKey = schema.name;
            } else {
              throw new LoaderError(`Schema file ${file} does not define a valid name`, filePath);
            }
          }

          // Check for duplicates (except for rbac which might be unique)
          if (collectionNames.has(schemaKey)) {
            throw new LoaderError(
              `Duplicate schema name '${schemaKey}' found in file ${file}`,
              filePath
            );
          }
          collectionNames.add(schemaKey);
          
          console.log("Loading schema:", schemaKey, "from file:", file);
          // Store schema in map
          schemas.set(schemaKey, schema);

          return { file, schema, success: true };
        } catch (error) {
          console.log(`Error loading schema from file ${file}:`, error);
          return { file, error, success: false };
        }
      });

      const results = await Promise.all(loadPromises);

      // Check for errors
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors.map((e: any) => `${e.file}: ${e.error.message}`).join('\n');
        throw new LoaderError(`Failed to load some schemas:\n${errorMessages}`);
      }

      // Resolve schema references
      const resolvedSchemas = await SchemaLoader.resolveSchemaReferences(schemas);

      return resolvedSchemas;
    } catch (error: any) {
      console.log(`Error loading schemas from directory ${schemasDir}:`, error);
      if (error instanceof LoaderError) {
        throw error;
      }
      throw new LoaderError(
        `Failed to load schemas from directory ${schemasDir}: ${error.message}`
      );
    }
  }

  /**
   * Validate schema object structure
   */
  private static async validateSchemaDefinition(schema: object): Promise<ValidationResult> {
    return SchemaValidator.validateSchemaDefinition(schema);
  }

  /**
   * Validate function schema structure
   */
  private static async validateFunctionSchemaDefinition(func: object): Promise<ValidationResult> {
    return SchemaValidator.validateFunctionSchemaDefinition(func);
  }

  private static async validateRBACSchemaDefinition(rbac: object): Promise<ValidationResult> {
    return SchemaValidator.validateRBACSchemaDefinition(rbac);
  }
  /**
   * Parse detailed field definition
   */
  static parseFieldDefinition(fieldDef: any): any {
    const parsed = {
      type: fieldDef.type,
      required: fieldDef.required || false,
      unique: fieldDef.unique || false,
      index: fieldDef.index || false,
      description: fieldDef.description,
      example: fieldDef.example,
      properties: fieldDef.properties || {},
      validators: fieldDef.validators || [],
      access: fieldDef.access || {},
      default: fieldDef.default
    };

    // Parse type-specific properties
    switch (fieldDef.type) {
      case 'string':
        Object.assign(parsed, {
          minLength: fieldDef.minLength,
          maxLength: fieldDef.maxLength,
          pattern: fieldDef.pattern,
          enum: fieldDef.enum,
          format: fieldDef.format,
          lowercase: fieldDef.lowercase,
          uppercase: fieldDef.uppercase,
          trim: fieldDef.trim !== false // default true
        });
        break;

      case 'number':
        Object.assign(parsed, {
          min: fieldDef.min,
          max: fieldDef.max,
          integer: fieldDef.integer,
          positive: fieldDef.positive
        });
        break;

      case 'array':
        Object.assign(parsed, {
          minItems: fieldDef.minItems,
          maxItems: fieldDef.maxItems,
          uniqueItems: fieldDef.uniqueItems,
          items: fieldDef.items ? SchemaLoader.parseFieldDefinition(fieldDef.items) : undefined
        });
        break;

      case 'object':
        if (fieldDef.properties) {
          parsed.properties = {};
          for (const [key, value] of Object.entries(fieldDef.properties)) {
            parsed.properties[key] = SchemaLoader.parseFieldDefinition(value);
          }
        }
        break;
    }

    // Parse validation rules
    if (fieldDef.validators) {
      parsed.validators = fieldDef.validators;
    }

    // Parse access control
    if (fieldDef.access) {
      parsed.access = fieldDef.access;
    }

    // Parse default value
    if (fieldDef.default !== undefined) {
      parsed.default = fieldDef.default;
    }

    return parsed;
  }

  /**
   * Resolve references between schemas
   */
  static async resolveSchemaReferences(schemas: Map<string, Schema>): Promise<Map<string, Schema>> {
    const resolvedSchemas = new Map<string, Schema>();
    const dependencyGraph = SchemaLoader.buildDependencyGraph(schemas);

    // Detect circular dependencies
    SchemaLoader.detectCircularDependencies(dependencyGraph);

    // Resolve relationships
    for (const [collectionName, schema] of schemas) {
      const resolvedSchema = { ...schema };

      if (schema.relationships) {
        for (const [relName, relationship] of Object.entries(schema.relationships)) {
          // Validate referenced collection exists
          if (!schemas.has(relationship.collection)) {
            throw new LoaderError(
              `Referenced collection '${relationship.collection}' not found in relationship '${relName}' of collection '${collectionName}'`
            );
          }

          // Additional relationship validation can be added here
        }
      }

      resolvedSchemas.set(collectionName, resolvedSchema);
    }

    return resolvedSchemas;
  }

  /**
   * Watch changes in schema files for auto-reload
   */
  static watchSchemaChanges(schemasDir: string, callback: Function): void {
    if (SchemaLoader.watchers.has(schemasDir)) {
      SchemaLoader.watchers.get(schemasDir)!.close();
    }

    const watcher = watch(path.join(schemasDir, '*.json'), {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', async (filePath) => {
      await SchemaLoader.handleFileChange('add', filePath, schemasDir, callback);
    });

    watcher.on('change', async (filePath) => {
      await SchemaLoader.handleFileChange('change', filePath, schemasDir, callback);
    });

    watcher.on('unlink', async (filePath) => {
      await SchemaLoader.handleFileChange('unlink', filePath, schemasDir, callback);
    });

    SchemaLoader.watchers.set(schemasDir, watcher);

    // Store callback
    if (!SchemaLoader.watchCallbacks.has(schemasDir)) {
      SchemaLoader.watchCallbacks.set(schemasDir, []);
    }
    SchemaLoader.watchCallbacks.get(schemasDir)!.push(callback);
  }

  /**
   * Stop watching schema changes
   */
  static stopWatching(schemasDir: string): void {
    if (SchemaLoader.watchers.has(schemasDir)) {
      SchemaLoader.watchers.get(schemasDir)!.close();
      SchemaLoader.watchers.delete(schemasDir);
      SchemaLoader.watchCallbacks.delete(schemasDir);
    }
  }

  /**
   * Clear schema cache
   */
  static clearCache(): void {
    SchemaLoader.schemaCache.clear();
  }

  /**
   * Get cached schema
   */
  static getCachedSchema(filePath: string): Schema | undefined {
    const cacheKey = path.resolve(filePath);
    return SchemaLoader.schemaCache.get(cacheKey);
  }

  // Private methods

  private static async getJsonFiles(directory: string): Promise<string[]> {
    const files = await readdir(directory);
    const jsonFiles: string[] = [];

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await stat(filePath);

      if (stats.isFile() && path.extname(file) === '.json') {
        jsonFiles.push(file);
      }
    }

    return jsonFiles;
  }

  private static buildDependencyGraph(schemas: Map<string, Schema>): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const [collectionName, schema] of schemas) {
      graph.set(collectionName, []);

      if (schema.relationships) {
        for (const relationship of Object.values(schema.relationships)) {
          if (relationship.collection && relationship.collection !== collectionName) {
            graph.get(collectionName)!.push(relationship.collection);
          }
        }
      }
    }

    return graph;
  }

  private static detectCircularDependencies(dependencyGraph: Map<string, string[]>): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (collection: string, path: string[] = []): boolean => {
      if (recursionStack.has(collection)) {
        throw new LoaderError(
          `Circular dependency detected: ${[...path, collection].join(' -> ')}`
        );
      }

      if (visited.has(collection)) {
        return false;
      }

      visited.add(collection);
      recursionStack.add(collection);

      const dependencies = dependencyGraph.get(collection) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep, [...path, collection])) {
          return true;
        }
      }

      recursionStack.delete(collection);
      return false;
    };

    for (const collection of dependencyGraph.keys()) {
      if (!visited.has(collection)) {
        hasCycle(collection);
      }
    }
  }

  private static async handleFileChange(
    event: string,
    filePath: string,
    schemasDir: string,
    callback: Function
  ): Promise<void> {
    try {
      // Clear cache for changed file
      SchemaLoader.schemaCache.delete(path.resolve(filePath));

      // Modify parent directory to get the directory name if "collections" or "functions"
      const parentDir = path.dirname(filePath);
      const dirName = path.basename(parentDir);

      // Reload all schemas
      const updatedSchemas = await SchemaLoader.loadAllSchemas(schemasDir, dirName);

      // Call callback with updated schemas
      callback({
        event,
        filePath,
        schemas: updatedSchemas
      });
    } catch (error: any) {
      callback({
        event,
        filePath,
        error: error.message
      });
    }
  }

  static getAllCachedSchemas(): Map<string, Schema> {
    if (SchemaLoader.schemaCache.size === 0) {
      throw new LoaderError('No schemas loaded in cache');
    }
    return SchemaLoader.schemaCache;
  }
}

// Export static methods for convenience
export const loadAllSchemas = SchemaLoader.loadAllSchemas.bind(SchemaLoader);
export const loadSchema = SchemaLoader.loadSchema.bind(SchemaLoader);
export const parseFieldDefinition = SchemaLoader.parseFieldDefinition.bind(SchemaLoader);