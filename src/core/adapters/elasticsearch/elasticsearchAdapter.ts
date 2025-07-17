import { 
  DatabaseType, 
  AdapterCapabilities, 
  ExecutionOptions,
  AdapterConfig
} from '../base/types';
import { 
  IntermediateQuery, 
  IntermediateQueryResult,
  FilterCondition,
  FieldCondition,
  SortClause
} from '../../types/intermediateQuery';
import { BaseDatabaseAdapter } from '../base/databaseAdapter';

/**
 * Elasticsearch adapter for converting intermediate queries to Elasticsearch DSL
 */
export class ElasticsearchAdapter extends BaseDatabaseAdapter {
  readonly name = 'elasticsearch';
  readonly type: DatabaseType = 'elasticsearch';
  readonly version = '1.0.0';

  private client?: any; // Elasticsearch client

  /**
   * Convert intermediate query to Elasticsearch DSL
   */
  convertQuery(query: IntermediateQuery): ElasticsearchQuery {
    const esQuery: ElasticsearchQuery = {
      index: query.collection,
      body: {
        query: { match_all: {} },
        _source: true,
        sort: [],
        from: 0,
        size: 10
      }
    };

    // Build query clause
    if (query.filter) {
      esQuery.body.query = this.convertFilter(query.filter);
    }

    // Build source filtering (field selection)
    if (query.select?.fields && query.select.fields.length > 0) {
      esQuery.body._source = this.convertSourceFilter(query.select.fields);
    }

    // Build sort
    if (query.sort && query.sort.length > 0) {
      esQuery.body.sort = this.convertSort(query.sort);
    }

    // Build pagination
    if (query.pagination) {
      if (query.pagination.offset) {
        esQuery.body.from = query.pagination.offset;
      }
      if (query.pagination.limit) {
        esQuery.body.size = query.pagination.limit;
      }
    }

    // Handle aggregations (joins are typically handled as nested queries in ES)
    if (query.joins && query.joins.length > 0) {
      esQuery.body.aggs = this.convertJoinsToAggregations(query.joins);
    }

    return esQuery;
  }

  /**
   * Execute Elasticsearch query
   */
  async executeQuery<T = any>(
    collectionName: string,
    intermediateQuery: IntermediateQuery,
    nativeQuery: ElasticsearchQuery, 
    options?: ExecutionOptions
  ): Promise<IntermediateQueryResult<T>> {
    this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('Elasticsearch client is not available');
    }

    const startTime = Date.now();
    
    try {
      const response = await this.client.search(nativeQuery);
      
      const data = response.body.hits.hits.map((hit: any) => ({
        _id: hit._id,
        _score: hit._score,
        ...hit._source
      }));

      const executionTime = Date.now() - startTime;

      const result = this.createResult(data, this.getCurrentQuery(), nativeQuery, executionTime);
      
      // Add Elasticsearch-specific metadata
      if (response.body.hits.total) {
        const total = typeof response.body.hits.total === 'object' ? 
          response.body.hits.total.value : 
          response.body.hits.total;
        
        if (result.pagination) {
          result.pagination.total = total;
        }
        
        result.count = total;
      }

      return result as IntermediateQueryResult;
    } catch (error) {
      throw new Error(`Elasticsearch query execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get Elasticsearch adapter capabilities
   */
  getCapabilities(): AdapterCapabilities {
    return {
      filterOperators: [
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'in', 'nin', 'exists', 'null', 'notnull',
        'regex', 'like', 'contains', 'startswith', 'endswith'
      ],
      joinTypes: ['nested', 'parent-child'], // Limited join support
      aggregations: [
        'count', 'sum', 'avg', 'min', 'max',
        'terms', 'date_histogram', 'histogram'
      ],
      fullTextSearch: true,
      transactions: false, // Elasticsearch doesn't support transactions
      nestedQueries: true,
      maxComplexity: 200,
      maxResultSize: 10000,
      custom: {
        supportsFullTextSearch: true,
        supportsGeoQueries: true,
        supportsAnalytics: true
      }
    };
  }

  /**
   * Initialize Elasticsearch adapter
   */
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.custom?.client) {
      this.client = config.custom.client;
    } else if (config.connection) {
      // Initialize Elasticsearch client
      const { Client } = await import('@elastic/elasticsearch');
      
      this.client = new Client({
        node: config.connection.connectionString || 
              `http://${config.connection.host || 'localhost'}:${config.connection.port || 9200}`,
        auth: config.connection.username && config.connection.password ? {
          username: config.connection.username,
          password: config.connection.password
        } : undefined,
      });
    }
  }

  /**
   * Test Elasticsearch connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const response = await this.client.ping();
      return response.statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * Convert filter to Elasticsearch query DSL
   */
  private convertFilter(filter: FilterCondition): any {
    if (filter.operator === 'and') {
      return {
        bool: {
          must: [
            ...(filter.conditions || []).map(c => this.convertFieldCondition(c)),
            ...(filter.nested || []).map(n => this.convertFilter(n))
          ]
        }
      };
    } else if (filter.operator === 'or') {
      return {
        bool: {
          should: [
            ...(filter.conditions || []).map(c => this.convertFieldCondition(c)),
            ...(filter.nested || []).map(n => this.convertFilter(n))
          ],
          minimum_should_match: 1
        }
      };
    } else if (filter.operator === 'not') {
      return {
        bool: {
          must_not: [
            ...(filter.conditions || []).map(c => this.convertFieldCondition(c)),
            ...(filter.nested || []).map(n => this.convertFilter(n))
          ]
        }
      };
    } else {
      // Default behavior - treat as AND
      const conditions = [
        ...(filter.conditions || []).map(c => this.convertFieldCondition(c)),
        ...(filter.nested || []).map(n => this.convertFilter(n))
      ];

      if (conditions.length === 1) {
        return conditions[0];
      } else if (conditions.length > 1) {
        return {
          bool: {
            must: conditions
          }
        };
      } else {
        return { match_all: {} };
      }
    }
  }

  /**
   * Convert field condition to Elasticsearch query
   */
  private convertFieldCondition(condition: FieldCondition): any {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'eq':
        return { term: { [field]: value } };
      
      case 'neq':
        return {
          bool: {
            must_not: { term: { [field]: value } }
          }
        };
      
      case 'gt':
        return { range: { [field]: { gt: value } } };
      
      case 'gte':
        return { range: { [field]: { gte: value } } };
      
      case 'lt':
        return { range: { [field]: { lt: value } } };
      
      case 'lte':
        return { range: { [field]: { lte: value } } };
      
      case 'in':
        const inValues = Array.isArray(value) ? value : [value];
        return { terms: { [field]: inValues } };
      
      case 'nin':
        const ninValues = Array.isArray(value) ? value : [value];
        return {
          bool: {
            must_not: { terms: { [field]: ninValues } }
          }
        };
      
      case 'exists':
        return value ? 
          { exists: { field } } : 
          { bool: { must_not: { exists: { field } } } };
      
      case 'null':
        return {
          bool: {
            must_not: { exists: { field } }
          }
        };
      
      case 'notnull':
        return { exists: { field } };
      
      case 'like':
      case 'contains':
        return {
          wildcard: {
            [field]: `*${value}*`
          }
        };
      
      case 'startswith':
        return {
          prefix: {
            [field]: value
          }
        };
      
      case 'endswith':
        return {
          wildcard: {
            [field]: `*${value}`
          }
        };
      
      case 'regex':
        return {
          regexp: {
            [field]: value
          }
        };
      
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Convert source filter
   */
  private convertSourceFilter(fields: string[]): string[] | boolean {
    if (fields.includes('*')) {
      return true;
    }
    
    return fields.filter(field => field !== '*');
  }

  /**
   * Convert sort clauses
   */
  private convertSort(sorts: SortClause[]): any[] {
    return sorts.map(sort => ({
      [sort.field]: {
        order: sort.direction === 'desc' ? 'desc' : 'asc'
      }
    }));
  }

  /**
   * Convert joins to aggregations (limited support)
   */
  private convertJoinsToAggregations(joins: any[]): any {
    const aggs: any = {};
    
    joins.forEach((join, index) => {
      // This is a simplified implementation
      // Real-world usage would depend on the specific Elasticsearch schema
      aggs[`join_${index}`] = {
        terms: {
          field: join.on?.[0]?.local || 'id'
        }
      };
    });

    return aggs;
  }

  // Temporary storage for current query context
  private currentQuery?: IntermediateQuery;

  private getCurrentQuery(): IntermediateQuery {
    return this.currentQuery || {} as IntermediateQuery;
  }

  setCurrentContext(query: IntermediateQuery): void {
    this.currentQuery = query;
  }
}

interface ElasticsearchQuery {
  index: string;
  body: {
    query: any;
    _source: boolean | string[];
    sort: any[];
    from: number;
    size: number;
    aggs?: any;
  };
}