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
  JoinClause,
  SortClause
} from '../../types/intermediateQuery';
import { BaseDatabaseAdapter } from '../base/databaseAdapter';

/**
 * PostgreSQL adapter for converting intermediate queries to SQL
 */
export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  readonly name = 'postgresql';
  readonly type: DatabaseType = 'postgresql';
  readonly version = '1.0.0';

  private pool?: any; // PostgreSQL connection pool

  /**
   * Convert intermediate query to PostgreSQL SQL
   */
  convertQuery(query: IntermediateQuery): PostgreSQLQuery {
    const sqlQuery: PostgreSQLQuery = {
      sql: '',
      params: [],
      paramIndex: 1
    };

    // Build SELECT clause
    const selectClause = this.buildSelectClause(query);
    
    // Build FROM clause with joins
    const fromClause = this.buildFromClause(query);
    
    // Build WHERE clause
    const whereClause = this.buildWhereClause(query.filter, sqlQuery);
    
    // Build ORDER BY clause
    const orderClause = this.buildOrderClause(query.sort);
    
    // Build LIMIT/OFFSET clause
    const limitClause = this.buildLimitClause(query.pagination, sqlQuery);

    // Combine all clauses
    sqlQuery.sql = [
      `SELECT ${selectClause}`,
      `FROM ${fromClause}`,
      whereClause ? `WHERE ${whereClause}` : '',
      orderClause ? `ORDER BY ${orderClause}` : '',
      limitClause
    ].filter(Boolean).join(' ');

    return sqlQuery;
  }

  /**
   * Execute PostgreSQL query
   */
  async executeQuery<T = any>(
    collectionName: string,
    intermediateQuery: IntermediateQuery,
    nativeQuery: PostgreSQLQuery, 
    options?: ExecutionOptions
  ): Promise<IntermediateQueryResult<T>> {
    this.ensureInitialized();
    
    if (!this.pool) {
      throw new Error('PostgreSQL connection pool is not available');
    }

    const startTime = Date.now();
    
    try {
      const client = await this.pool.connect();
      
      try {
        const result = await client.query({
          text: nativeQuery.sql,
          values: nativeQuery.params,
          ...(options?.timeout && { timeout: options.timeout })
        });

        const data = result.rows;
        const executionTime = Date.now() - startTime;

        return this.createResult(data, this.getCurrentQuery(), nativeQuery, executionTime);
      } finally {
        client.release();
      }
    } catch (error) {
      throw new Error(`PostgreSQL query execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get PostgreSQL adapter capabilities
   */
  getCapabilities(): AdapterCapabilities {
    return {
      filterOperators: [
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'in', 'nin', 'like', 'ilike', 'regex',
        'null', 'notnull', 'exists'
      ],
      joinTypes: [
        'inner', 'left', 'right', 'full',
        'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'
      ],
      aggregations: [
        'count', 'sum', 'avg', 'min', 'max',
        'group', 'having', 'distinct'
      ],
      fullTextSearch: true,
      transactions: true,
      nestedQueries: true,
      maxComplexity: 50,
      maxResultSize: 100000
    };
  }

  /**
   * Initialize PostgreSQL adapter
   */
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.custom?.pool) {
      this.pool = config.custom.pool;
    } else if (config.connection) {
      // Initialize PostgreSQL connection pool
      const { Pool } = await import('pg');

      this.pool = new Pool({
        host: config.connection.host,
        port: config.connection.port || 5432,
        database: config.connection.database,
        user: config.connection.username,
        password: config.connection.password,
        ...config.connection.pool,
        ssl: config.connection.ssl
      });
    }
  }

  /**
   * Test PostgreSQL connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build SELECT clause
   */
  private buildSelectClause(query: IntermediateQuery): string {
    if (!query.select?.fields || query.select.fields.length === 0) {
      return `${query.collection}.*`;
    }

    const fields: string[] = [];

    query.select.fields.forEach(field => {
      if (field === '*') {
        fields.push(`${query.collection}.*`);
      } else if (field.includes('.')) {
        // Handle joined table fields
        fields.push(this.escapeIdentifier(field));
      } else {
        fields.push(`${query.collection}.${this.escapeIdentifier(field)}`);
      }
    });

    // Handle aliases
    if (query.select.aliases) {
      Object.entries(query.select.aliases).forEach(([alias, field]) => {
        const fieldRef = field.includes('.') ? 
          this.escapeIdentifier(field) : 
          `${query.collection}.${this.escapeIdentifier(field)}`;
        fields.push(`${fieldRef} AS ${this.escapeIdentifier(alias)}`);
      });
    }

    return fields.join(', ');
  }

  /**
   * Build FROM clause with JOINs
   */
  private buildFromClause(query: IntermediateQuery): string {
    let fromClause = this.escapeIdentifier(query.collection);

    if (query.joins && query.joins.length > 0) {
      query.joins.forEach(join => {
        fromClause += ` ${this.buildJoinClause(join, query.collection)}`;
      });
    }

    return fromClause;
  }

  /**
   * Build JOIN clause
   */
  private buildJoinClause(join: JoinClause, sourceTable: string): string {
    const joinType = this.mapJoinType(join.type);
    const targetAlias = join.alias || join.target;
    
    let joinClause = `${joinType} ${this.escapeIdentifier(join.target)}`;
    
    if (targetAlias !== join.target) {
      joinClause += ` AS ${this.escapeIdentifier(targetAlias)}`;
    }

    // Build ON conditions
    if (join.on && join.on.length > 0) {
      const conditions = join.on.map(condition => {
        const localField = condition.local.includes('.') ? 
          condition.local : 
          `${sourceTable}.${condition.local}`;
        const foreignField = condition.foreign.includes('.') ? 
          condition.foreign : 
          `${targetAlias}.${condition.foreign}`;
        
        return `${this.escapeIdentifier(localField)} = ${this.escapeIdentifier(foreignField)}`;
      });

      joinClause += ` ON ${conditions.join(' AND ')}`;
    }

    return joinClause;
  }

  /**
   * Map join type to PostgreSQL syntax
   */
  private mapJoinType(joinType: string): string {
    switch (joinType) {
      case 'inner':
      case 'one-to-one':
      case 'many-to-one':
        return 'INNER JOIN';
      case 'left':
      case 'one-to-many':
        return 'LEFT JOIN';
      case 'right':
        return 'RIGHT JOIN';
      case 'full':
        return 'FULL OUTER JOIN';
      default:
        return 'LEFT JOIN';
    }
  }

  /**
   * Build WHERE clause
   */
  private buildWhereClause(filter: FilterCondition | undefined, sqlQuery: PostgreSQLQuery): string {
    if (!filter) return '';

    return this.buildFilterCondition(filter, sqlQuery);
  }

  /**
   * Build filter condition
   */
  private buildFilterCondition(filter: FilterCondition, sqlQuery: PostgreSQLQuery): string {
    const conditions: string[] = [];

    // Handle field conditions
    if (filter.conditions && filter.conditions.length > 0) {
      const fieldConditions = filter.conditions.map(condition => 
        this.buildFieldCondition(condition, sqlQuery)
      );
      conditions.push(...fieldConditions);
    }

    // Handle nested conditions
    if (filter.nested && filter.nested.length > 0) {
      const nestedConditions = filter.nested.map(nested => 
        `(${this.buildFilterCondition(nested, sqlQuery)})`
      );
      conditions.push(...nestedConditions);
    }

    if (conditions.length === 0) return '';

    // Apply logical operator
    switch (filter.operator) {
      case 'or':
        return conditions.join(' OR ');
      case 'not':
        return `NOT (${conditions.join(' AND ')})`;
      case 'and':
      default:
        return conditions.join(' AND ');
    }
  }

  /**
   * Build field condition
   */
  private buildFieldCondition(condition: FieldCondition, sqlQuery: PostgreSQLQuery): string {
    const field = this.escapeIdentifier(condition.field);
    const paramPlaceholder = `$${sqlQuery.paramIndex++}`;

    switch (condition.operator) {
      case 'eq':
        sqlQuery.params.push(condition.value);
        return `${field} = ${paramPlaceholder}`;
      
      case 'neq':
        sqlQuery.params.push(condition.value);
        return `${field} != ${paramPlaceholder}`;
      
      case 'gt':
        sqlQuery.params.push(condition.value);
        return `${field} > ${paramPlaceholder}`;
      
      case 'gte':
        sqlQuery.params.push(condition.value);
        return `${field} >= ${paramPlaceholder}`;
      
      case 'lt':
        sqlQuery.params.push(condition.value);
        return `${field} < ${paramPlaceholder}`;
      
      case 'lte':
        sqlQuery.params.push(condition.value);
        return `${field} <= ${paramPlaceholder}`;
      
      case 'in':
        const inValues = Array.isArray(condition.value) ? condition.value : [condition.value];
        sqlQuery.params.push(inValues);
        return `${field} = ANY(${paramPlaceholder})`;
      
      case 'nin':
        const ninValues = Array.isArray(condition.value) ? condition.value : [condition.value];
        sqlQuery.params.push(ninValues);
        return `${field} != ALL(${paramPlaceholder})`;
      
      case 'like':
        sqlQuery.params.push(condition.value);
        return `${field} LIKE ${paramPlaceholder}`;
      
      case 'ilike':
        sqlQuery.params.push(condition.value);
        return `${field} ILIKE ${paramPlaceholder}`;
      
      case 'regex':
        sqlQuery.params.push(condition.value);
        return `${field} ~ ${paramPlaceholder}`;
      
      case 'null':
        return `${field} IS NULL`;
      
      case 'notnull':
        return `${field} IS NOT NULL`;
      
      case 'exists':
        return condition.value ? `${field} IS NOT NULL` : `${field} IS NULL`;
      
      default:
        throw new Error(`Unsupported operator: ${condition.operator}`);
    }
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderClause(sorts: SortClause[] | undefined): string {
    if (!sorts || sorts.length === 0) return '';

    const orderItems = sorts.map(sort => {
      const field = this.escapeIdentifier(sort.field);
      const direction = sort.direction.toUpperCase();
      const nulls = sort.nulls ? ` NULLS ${sort.nulls.toUpperCase()}` : '';
      
      return `${field} ${direction}${nulls}`;
    });

    return orderItems.join(', ');
  }

  /**
   * Build LIMIT/OFFSET clause
   */
  private buildLimitClause(
    pagination: any, 
    sqlQuery: PostgreSQLQuery
  ): string {
    const clauses: string[] = [];

    if (pagination?.limit) {
      clauses.push(`LIMIT $${sqlQuery.paramIndex++}`);
      sqlQuery.params.push(pagination.limit);
    }

    if (pagination?.offset) {
      clauses.push(`OFFSET $${sqlQuery.paramIndex++}`);
      sqlQuery.params.push(pagination.offset);
    }

    return clauses.join(' ');
  }

  /**
   * Escape SQL identifier
   */
  private escapeIdentifier(identifier: string): string {
    return identifier.split('.').map(part => `"${part}"`).join('.');
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

interface PostgreSQLQuery {
  sql: string;
  params: any[];
  paramIndex: number;
}