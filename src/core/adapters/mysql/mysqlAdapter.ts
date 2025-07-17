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
 * MySQL adapter for converting intermediate queries to MySQL SQL
 */
export class MySQLAdapter extends BaseDatabaseAdapter {
  readonly name = 'mysql';
  readonly type: DatabaseType = 'mysql';
  readonly version = '1.0.0';

  private pool?: any; // MySQL connection pool
  
  /**
   * Convert intermediate query to MySQL SQL
   */
  convertQuery(query: IntermediateQuery): MySQLQuery {
    const sqlQuery: MySQLQuery = {
      sql: '',
      params: []
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
   * Execute MySQL query
   */
  async executeQuery<T = any>(
    collectionName: string,
    intermediateQuery: IntermediateQuery,
    nativeQuery: MySQLQuery, 
    options?: ExecutionOptions
  ): Promise<IntermediateQueryResult<T>> {
    this.ensureInitialized();
    
    if (!this.pool) {
      throw new Error('MySQL connection pool is not available');
    }

    const startTime = Date.now();
    
    try {
      const connection = await this.pool.getConnection();
      
      try {
        const [rows] = await connection.execute({
          sql: nativeQuery.sql,
          values: nativeQuery.params,
          ...(options?.timeout && { timeout: options.timeout })
        });

        const data = Array.isArray(rows) ? rows : [rows];
        const executionTime = Date.now() - startTime;

        return this.createResult(data, this.getCurrentQuery(), nativeQuery, executionTime);
      } finally {
        connection.release();
      }
    } catch (error) {
      throw new Error(`MySQL query execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get MySQL adapter capabilities
   */
  getCapabilities(): AdapterCapabilities {
    return {
      filterOperators: [
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'in', 'nin', 'like', 'regex',
        'null', 'notnull', 'exists'
      ],
      joinTypes: [
        'inner', 'left', 'right', 'cross',
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
   * Initialize MySQL adapter
   */
  async initialize(config: AdapterConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.custom?.pool) {
      this.pool = config.custom.pool;
    } else if (config.connection) {
      // Initialize MySQL connection pool
      const mysql = await import('mysql2/promise');
      
      // Prepare pool config and handle ssl property
      const poolConfig: any = {
        host: config.connection.host || 'localhost',
        port: config.connection.port || 3306,
        database: config.connection.database,
        user: config.connection.username,
        password: config.connection.password,
        waitForConnections: true,
        connectionLimit: config.connection.pool?.max || 10,
        queueLimit: 0
      };
      if (config.connection.ssl !== false && config.connection.ssl !== undefined) {
        poolConfig.ssl = config.connection.ssl;
      }
      this.pool = mysql.createPool(poolConfig);
    }
  }

  /**
   * Test MySQL connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
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
      return `${this.escapeIdentifier(query.collection)}.*`;
    }

    const fields: string[] = [];

    query.select.fields.forEach(field => {
      if (field === '*') {
        fields.push(`${this.escapeIdentifier(query.collection)}.*`);
      } else if (field.includes('.')) {
        // Handle joined table fields
        fields.push(this.escapeIdentifier(field));
      } else {
        fields.push(`${this.escapeIdentifier(query.collection)}.${this.escapeIdentifier(field)}`);
      }
    });

    // Handle aliases
    if (query.select.aliases) {
      Object.entries(query.select.aliases).forEach(([alias, field]) => {
        const fieldRef = field.includes('.') ? 
          this.escapeIdentifier(field) : 
          `${this.escapeIdentifier(query.collection)}.${this.escapeIdentifier(field)}`;
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
   * Map join type to MySQL syntax
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
      case 'cross':
        return 'CROSS JOIN';
      default:
        return 'LEFT JOIN';
    }
  }

  /**
   * Build WHERE clause
   */
  private buildWhereClause(filter: FilterCondition | undefined, sqlQuery: MySQLQuery): string {
    if (!filter) return '';

    return this.buildFilterCondition(filter, sqlQuery);
  }

  /**
   * Build filter condition
   */
  private buildFilterCondition(filter: FilterCondition, sqlQuery: MySQLQuery): string {
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
  private buildFieldCondition(condition: FieldCondition, sqlQuery: MySQLQuery): string {
    const field = this.escapeIdentifier(condition.field);

    switch (condition.operator) {
      case 'eq':
        sqlQuery.params.push(condition.value);
        return `${field} = ?`;
      
      case 'neq':
        sqlQuery.params.push(condition.value);
        return `${field} != ?`;
      
      case 'gt':
        sqlQuery.params.push(condition.value);
        return `${field} > ?`;
      
      case 'gte':
        sqlQuery.params.push(condition.value);
        return `${field} >= ?`;
      
      case 'lt':
        sqlQuery.params.push(condition.value);
        return `${field} < ?`;
      
      case 'lte':
        sqlQuery.params.push(condition.value);
        return `${field} <= ?`;
      
      case 'in':
        const inValues = Array.isArray(condition.value) ? condition.value : [condition.value];
        const inPlaceholders = inValues.map(() => '?').join(', ');
        sqlQuery.params.push(...inValues);
        return `${field} IN (${inPlaceholders})`;
      
      case 'nin':
        const ninValues = Array.isArray(condition.value) ? condition.value : [condition.value];
        const ninPlaceholders = ninValues.map(() => '?').join(', ');
        sqlQuery.params.push(...ninValues);
        return `${field} NOT IN (${ninPlaceholders})`;
      
      case 'like':
        sqlQuery.params.push(condition.value);
        return `${field} LIKE ?`;
      
      case 'regex':
        sqlQuery.params.push(condition.value);
        return `${field} REGEXP ?`;
      
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
      
      return `${field} ${direction}`;
    });

    return orderItems.join(', ');
  }

  /**
   * Build LIMIT/OFFSET clause
   */
  private buildLimitClause(
    pagination: any, 
    sqlQuery: MySQLQuery
  ): string {
    const clauses: string[] = [];

    if (pagination?.limit) {
      if (pagination?.offset) {
        clauses.push('LIMIT ?, ?');
        sqlQuery.params.push(pagination.offset, pagination.limit);
      } else {
        clauses.push('LIMIT ?');
        sqlQuery.params.push(pagination.limit);
      }
    }

    return clauses.join(' ');
  }

  /**
   * Escape SQL identifier
   */
  private escapeIdentifier(identifier: string): string {
    return identifier.split('.').map(part => `\`${part}\``).join('.');
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

interface MySQLQuery {
  sql: string;
  params: any[];
}