import { QueryParams } from '../types';
import { 
  IntermediateQuery, 
  FilterCondition, 
  FieldCondition, 
  ComparisonOperator,
  SelectClause,
  SortClause,
  PaginationClause,
  JoinClause,
  JoinType,
  RelationshipMeta
} from '../types/intermediateQuery';
import { QueryErrors } from '../errors/errorFactories';

/**
 * Converts URL query parameters to intermediate JSON format
 */
export class QueryConverter {
  private currentQuery: IntermediateQuery | null = null;

  constructor() {
    // Initialize any necessary state or dependencies here
  }

  /**
   * Main conversion method
   */
  convert(params: QueryParams, collection: string, roles: string[] = []): IntermediateQuery {
    const query: IntermediateQuery = {
      collection,
      metadata: {
        originalParams: params,
        roles,
        timestamp: new Date(),
        source: 'rest-api'
      }
    };

    // Set current query for processing
    this.currentQuery = query;

    // Process each parameter
    Object.entries(params).forEach(([key, value]) => {
      const paramValue = Array.isArray(value) ? value[0] : value;
      
      // Handle special parameters
      if (this.isSpecialParameter(key)) {
        this.handleSpecialParameter(key, paramValue, query);
        return;
      }

      // Handle logical operators
      if (this.isLogicalOperator(key)) {
        this.handleLogicalOperator(key, paramValue, query);
        return;
      }

      // Handle regular field filters
      this.handleFieldFilter(key, paramValue, query);
    });

    return query;
  }

  private isSpecialParameter(key: string): boolean {
    return ['select', 'order', 'limit', 'skip', 'offset', 'count'].includes(key);
  }

  private handleSpecialParameter(key: string, value: string, query: IntermediateQuery): void {
    switch (key) {
      case 'select':
        query.select = this.parseSelect(value);
        break;
      case 'order':
        query.sort = this.parseSort(value);
        break;
      case 'limit':
        query.pagination = query.pagination || {};
        query.pagination.limit = parseInt(value);
        break;
      case 'skip':
      case 'offset':
        query.pagination = query.pagination || {};
        query.pagination.offset = parseInt(value);
        break;
      case 'count':
        query.pagination = query.pagination || {};
        query.pagination.count = value === 'true' || value === 'exact';
        break;
    }
  }

  private parseSelect(selectClause: string): SelectClause {
    if (!selectClause || selectClause === '*') {
      return { fields: [] }; // Empty means all fields
    }

    const result: SelectClause = {
      fields: [],
      aliases: {},
      computed: []
    };

    // Parse embedded relationships and regular fields
    const tokens = this.tokenizeSelect(selectClause);
    
    tokens.forEach(token => {
      if (this.isEmbedExpression(token)) {
        // Handle embedded relationship - convert to joins
        const joinClause = this.parseEmbedToJoin(token);
        if (joinClause) {
          // Add to query joins
          if (this.currentQuery) {
            if (!this.currentQuery.joins) {
              this.currentQuery.joins = [];
            }
            this.currentQuery.joins.push(joinClause);
          } else {
            throw QueryErrors.currentQueryNotInitialized();
          }
          
          // Add field for projection
          if (!result.fields) result.fields = [];
          result.fields.push(`${joinClause.alias || joinClause.target}`);
        }
      } else {
        // Regular field
        const field = this.parseRegularField(token);
        if (field) {
          if (field.alias) {
            result.aliases = result.aliases || {};
            result.aliases[field.alias] = field.field;
          }
          result.fields = result.fields || [];
          result.fields.push(field.field);
        }
      }
    });

    return result;
  }

  private parseSort(orderClause: string): SortClause[] {
    const sorts: SortClause[] = [];
    const fields = orderClause.split(',');
    
    fields.forEach(field => {
      const trimmed = field.trim();
      if (trimmed.startsWith('-')) {
        sorts.push({
          field: trimmed.substring(1),
          direction: 'desc'
        });
      } else {
        sorts.push({
          field: trimmed,
          direction: 'asc'
        });
      }
    });

    return sorts;
  }

  private isLogicalOperator(key: string): boolean {
    return ['and', 'or', 'not'].includes(key) || key.startsWith('not.');
  }

  private handleLogicalOperator(key: string, value: string, query: IntermediateQuery): void {
    const condition = this.parseLogicalCondition(key, value);
    if (condition) {
      if (!query.filter) {
        query.filter = condition;
      } else {
        // Combine with existing filter using AND
        query.filter = {
          operator: 'and',
          nested: [query.filter, condition]
        };
      }
    }
  }

  private parseLogicalCondition(key: string, value: string): FilterCondition | null {
    const operator = key.startsWith('not.') ? 'not' : key as 'and' | 'or';
    
    // Remove parentheses and split by comma (respecting nested parentheses)
    const conditionStrings = this.parseLogicalValue(value);
    const conditions: FieldCondition[] = [];
    const nested: FilterCondition[] = [];

    conditionStrings.forEach(condStr => {
      // Check if condStr is a nested logical condition (e.g., "or=(...)" or "and=(...)")
      if (condStr.startsWith('and=') || condStr.startsWith('or=')) {
        const nestedKey = condStr.substring(0, condStr.indexOf('='));
        const nestedValue = condStr.substring(condStr.indexOf('=') + 1);
        const nestedCondition = this.parseLogicalCondition(nestedKey, nestedValue);
        if (nestedCondition) {
          nested.push(nestedCondition);
        }
      } else {
        let fieldCondition: FieldCondition | null = null;

        if (condStr.includes('=')) {
          // Format: "field.path=operator.value"
          const equalIndex = condStr.lastIndexOf('=');
          const fieldPath = condStr.substring(0, equalIndex);
          const operatorValue = condStr.substring(equalIndex + 1);

          // Split operator.value
          const dotIndex = operatorValue.indexOf('.');
          if (dotIndex > 0) {
            const operator = operatorValue.substring(0, dotIndex);
            const value = operatorValue.substring(dotIndex + 1);

            fieldCondition = {
              field: fieldPath,
              operator: operator as ComparisonOperator,
              value: this.parseValue(value)
            };
          }
        } else {
          // Format: "field.operator.value"
          fieldCondition = this.parseFieldCondition(condStr);
        }

        if (fieldCondition) {
          conditions.push(fieldCondition);
        }
      }
    });

    if (conditions.length === 0 && nested.length === 0) return null;

    return {
      operator,
      conditions: conditions.length > 0 ? conditions : undefined,
      nested: nested.length > 0 ? nested : undefined
    };
  }

  private parseLogicalValue(value: string): string[] {
    // Remove outer parentheses if present
    let cleanValue = value.trim();
    if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
      cleanValue = cleanValue.slice(1, -1);
    }

    // Split by comma, respecting nested parentheses
    const conditions: string[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < cleanValue.length; i++) {
      const char = cleanValue[i];

      if ((char === '"' || char === "'") && cleanValue[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
        current += char;
      } else if (!inQuotes) {
        if (char === '(') {
          depth++;
          current += char;
        } else if (char === ')') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          if (current.trim()) {
            conditions.push(current.trim());
          }
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      conditions.push(current.trim());
    }

    return conditions;
  }

  private handleFieldFilter(key: string, value: string, query: IntermediateQuery): void {
    let condition: FieldCondition | null = null;

    // Handle format: "field=op.value" or "field.op.value"
    if (value.includes('=')) {
      const equalIndex = value.lastIndexOf('=');
      const fieldPath = key;
      const operatorValue = value.substring(equalIndex + 1);
      const dotIndex = operatorValue.indexOf('.');
      if (dotIndex > 0) {
        const operator = operatorValue.substring(0, dotIndex);
        const val = operatorValue.substring(dotIndex + 1);
        condition = {
          field: fieldPath,
          operator: operator as ComparisonOperator,
          value: this.parseValue(val)
        };
      }
    } else {
      condition = this.parseFieldCondition(`${key}.${value}`);
    }

    if (condition) {
      if (!query.filter) {
        query.filter = { conditions: [condition] };
      } else if (query.filter.conditions) {
        query.filter.conditions.push(condition);
      } else {
        // Convert existing filter to AND with new condition
        query.filter = {
          operator: 'and',
          nested: [query.filter],
          conditions: [condition]
        };
      }
    }
  }

  private parseFieldCondition(conditionStr: string): FieldCondition | null {
    // Parse conditions like "field.op.value" or "field.in.(value1,value2)"
    const parts = conditionStr.split('.');
    if (parts.length < 3) return null;

    const field = parts[0];
    const operator = parts[1] as ComparisonOperator;
    const valuePart = parts.slice(2).join('.');

    let value: any;
    
    // Handle array values like "in.(value1,value2)"
    if (valuePart.startsWith('(') && valuePart.endsWith(')')) {
      const arrayStr = valuePart.slice(1, -1);
      value = arrayStr.split(',').map(v => this.parseValue(v.trim()));
    } else {
      value = this.parseValue(valuePart);
    }

    return {
      field,
      operator,
      value
    };
  }

  private parseValue(valueStr: string): any {
    // Handle null
    if (valueStr === 'null') return null;
    
    // Handle boolean
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    // Handle numbers
    if (/^\d+$/.test(valueStr)) {
      return parseInt(valueStr);
    }
    if (/^\d+\.\d+$/.test(valueStr)) {
      return parseFloat(valueStr);
    }
    
    // Handle strings (remove quotes if present)
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }
    
    return valueStr;
  }

  private tokenizeSelect(expression: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if ((char === '"' || char === "'") && expression[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
        current: current += char;
      } else if (!inQuotes) {
        if (char === '(') {
          depth++;
          current += char;
        } else if (char === ')') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          if (current.trim()) {
            tokens.push(current.trim());
          }
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  private isEmbedExpression(token: string): boolean {
    const trimmed = token.trim();
    
    // Must have both opening and closing parentheses
    if (!trimmed.includes('(') || !trimmed.includes(')')) {
      return false;
    }

    // Must not be a quoted string
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return false;
    }

    // Check if it looks like a function call (name followed by parentheses)
    const functionPattern = /^[a-zA-Z_][a-zA-Z0-9_]*\(/;
    return functionPattern.test(trimmed);
  }

  private parseEmbedToJoin(embedExpr: string): JoinClause | null {
    // Parse expressions with nested parentheses
    const openIndex = embedExpr.indexOf('(');
    if (openIndex === -1) {
      return null;
    }
    
    const relationName = embedExpr.substring(0, openIndex);
    
    // Find matching closing parenthesis
    let depth = 0;
    let closeIndex = -1;
    
    for (let i = openIndex; i < embedExpr.length; i++) {
      if (embedExpr[i] === '(') {
        depth++;
      } else if (embedExpr[i] === ')') {
        depth--;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }
    
    if (closeIndex === -1 || closeIndex !== embedExpr.length - 1) {
      return null;
    }
    
    const innerExpr = embedExpr.substring(openIndex + 1, closeIndex);
    
    const target = relationName;

    const joinClause: JoinClause = {
      type: 'lookup' as JoinType,
      target,
      alias: relationName,
      on: [], // Will be populated by relationship registry
      relationship: {
        name: relationName.replace('look_', '')
      }
    };

    // Parse inner expression for filters and nested joins
    if (innerExpr) {
      const nestedJoins = this.parseNestedJoinsAndFilters(innerExpr, target);
      if (nestedJoins.filter) {
        joinClause.filter = nestedJoins.filter;
      }
      if (nestedJoins.joins && nestedJoins.joins.length > 0) {
        joinClause.joins = nestedJoins.joins;
      }
    }

    return joinClause;
  }

  private parseNestedJoinsAndFilters(innerExpr: string, parentTable: string): {
    filter?: FilterCondition;
    joins?: JoinClause[];
  } {
    const result: { filter?: FilterCondition; joins?: JoinClause[] } = {};
    
    // Parse the inner expression which can contain both filters and nested joins
    const tokens = this.tokenizeSelect(innerExpr);
    const joins: JoinClause[] = [];
    const filterConditions: FilterCondition[] = [];

    tokens.forEach(token => {
      if (this.isEmbedExpression(token)) {
        // It's a nested join
        const nestedJoin = this.parseEmbedToJoin(token);
        if (nestedJoin) {
          joins.push(nestedJoin);
        }
      } else if (this.isLogicalOperator(token.split('=')[0])) {
        // It's a logical filter
        const condition = this.parseLogicalCondition(token.split('=')[0], token.split('=').slice(1).join('='));
        if (condition) {
          filterConditions.push(condition);
        }
      } else if (token.includes('=') && !token.startsWith('or=') && !token.startsWith('and=')) {
        // It's a field filter like "field=eq.value" or "field.eq.value"
        let processedToken = token;
        
        // Handle format "field=op.value" -> "field.op.value"
        if (token.includes('=') && !token.includes('.eq.') && !token.includes('.neq.') && !token.includes('.gt.')) {
          const equalIndex = token.indexOf('=');
          const beforeEqual = token.substring(0, equalIndex);
          const afterEqual = token.substring(equalIndex + 1);
          processedToken = `${beforeEqual}.${afterEqual}`;
        }
        
        const fieldCondition = this.parseFieldCondition(processedToken);
        if (fieldCondition) {
          filterConditions.push({
            conditions: [fieldCondition]
          });
        }
      }
    });

    if (joins.length > 0) {
      result.joins = joins;
    }

    if (filterConditions.length > 0) {
      if (filterConditions.length === 1) {
        result.filter = filterConditions[0];
      } else {
        result.filter = {
          operator: 'and',
          nested: filterConditions
        };
      }
    }

    return result;
  }

  private parseRegularField(token: string): { field: string; alias?: string } | null {
    const trimmed = token.trim();
    
    if (!trimmed) return null;

    // Handle alias format: "alias:field"
    if (trimmed.includes(':') && !trimmed.includes('::')) {
      const [alias, field] = trimmed.split(':');
      return {
        field: field.trim(),
        alias: alias.trim()
      };
    }

    // Handle JSON path like "data->field"
    if (trimmed.includes('->')) {
      return {
        field: trimmed.split('->')[0]
      };
    }

    // Handle casting like "field::text"
    if (trimmed.includes('::')) {
      return {
        field: trimmed.split('::')[0]
      };
    }

    return { field: trimmed };
  }
}