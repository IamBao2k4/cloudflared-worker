
import { AdapterErrors } from '../../errors/errorFactories';
import { IntermediateQuery, IntermediateQueryResult } from '../../types/intermediateQuery';
import { AdapterCapabilities, AdapterConfig, DatabaseAdapter, DatabaseType, ExecutionOptions, ValidationError, ValidationResult, ValidationWarning } from './types';
/**
 * Abstract base class for database adapters
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  abstract readonly name: string;
  abstract readonly type: DatabaseType;
  abstract readonly version: string;

  protected config?: AdapterConfig;
  protected isInitialized = false;

  abstract convertQuery(query: IntermediateQuery): any;
  abstract executeQuery<T = any>(collectionName: string,query: IntermediateQuery, nativeQuery: any, options?: ExecutionOptions): Promise<IntermediateQueryResult<T>>;

  validateQuery(query: IntermediateQuery): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    if (!query.collection) {
      errors.push({
        code: 'MISSING_COLLECTION',
        message: 'Collection/table name is required',
        path: 'collection'
      });
    }

    // Validate against capabilities
    const capabilities = this.getCapabilities();
    
    // Check filter operators
    if (query.filter) {
      this.validateFilterOperators(query.filter, capabilities, errors);
    }

    // Check join types
    if (query.joins) {
      query.joins.forEach((join, index) => {
        if (!capabilities.joinTypes.includes(join.type)) {
          errors.push({
            code: 'UNSUPPORTED_JOIN_TYPE',
            message: `Join type '${join.type}' is not supported`,
            path: `joins[${index}].type`
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  protected validateFilterOperators(filter: any, capabilities: AdapterCapabilities, errors: ValidationError[]): void {
    if (filter.conditions) {
      filter.conditions.forEach((condition: any, index: number) => {
        if (!capabilities.filterOperators.includes(condition.operator)) {
          errors.push({
            code: 'UNSUPPORTED_OPERATOR',
            message: `Filter operator '${condition.operator}' is not supported`,
            path: `filter.conditions[${index}].operator`
          });
        }
      });
    }

    if (filter.nested) {
      filter.nested.forEach((nested: any) => {
        this.validateFilterOperators(nested, capabilities, errors);
      });
    }
  }

  abstract getCapabilities(): AdapterCapabilities;

  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
  }

  async dispose(): Promise<void> {
    this.isInitialized = false;
  }

  abstract testConnection(): Promise<boolean>;

  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw AdapterErrors.notInitialized(this.name);
    }
  }

  protected createResult<T>(
    data: T[],
    query: IntermediateQuery,
    nativeQuery: any,
    executionTime?: number
  ): IntermediateQueryResult<T> {
    const result: IntermediateQueryResult<T> = {
      data,
      metadata: {
        adapter: this.name,
        query,
        nativeQuery,
        executionTime
      }
    };

    // Add pagination info if applicable
    if (query.pagination) {
      result.pagination = {
        offset: query.pagination.offset || 0,
        limit: query.pagination.limit || data.length,
        hasMore: query.pagination.limit ? data.length >= query.pagination.limit : false
      };
    }

    return result;
  }
}