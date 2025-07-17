import { FilterCondition, FieldCondition } from '../../../types/intermediateQuery';
import { ObjectId } from 'mongodb';

export class FilterConverter {
  /**
   * Convert filter condition to MongoDB match expression
   */
  static convertFilter(filter: FilterCondition): any {
    const result: any = {};

    // Handle field conditions
    if (filter.conditions && filter.conditions.length > 0) {
      const conditions = filter.conditions.map(condition => 
        this.convertFieldCondition(condition)
      );

      if (filter.operator === 'or') {
        result.$or = conditions;
      } else if (filter.operator === 'not') {
        result.$not = { $and: conditions };
      } else if (conditions.length === 1 && !filter.operator) {
        // Single condition without operator
        Object.assign(result, conditions[0]);
      } else {
        // Multiple conditions or explicit 'and'
        result.$and = conditions;
      }
    }

    // Handle nested conditions
    if (filter.nested && filter.nested.length > 0) {
      const nestedConditions = filter.nested.map(nested => 
        this.convertFilter(nested)
      );

      if (filter.operator === 'or') {
        result.$or = nestedConditions;
      } else if (filter.operator === 'not') {
        result.$not = nestedConditions[0];
      } else {
        // Default to 'and'
        if (result.$and) {
          result.$and.push(...nestedConditions);
        } else {
          result.$and = nestedConditions;
        }
      }
    }

    return result;
  }

  /**
   * Convert field condition to MongoDB expression
   */
  static convertFieldCondition(condition: FieldCondition): any {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'eq':
        return { [field]: value };
      
      case 'neq':
        return { [field]: { $ne: value } };
      
      case 'gt':
        return { [field]: { $gt: value } };
      
      case 'gte':
        return { [field]: { $gte: value } };
      
      case 'lt':
        return { [field]: { $lt: value } };
      
      case 'lte':
        return { [field]: { $lte: value } };
      
      case 'in':
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      
      case 'nin':
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
      
      case 'exists':
        return { [field]: { $exists: value === true } };
      
      case 'null':
        return { [field]: null };
      
      case 'notnull':
        return { [field]: { $ne: null } };
      
      case 'regex':
        return { [field]: { $regex: value, $options: 'i' } };
      
      case 'like':
      case 'ilike':
        const pattern = value.replace(/%/g, '.*').replace(/_/g, '.');
        return { [field]: { $regex: pattern, $options: 'i' } };
      
      case 'contains':
        return { [field]: { $regex: value, $options: 'i' } };
      
      case 'startswith':
        return { [field]: { $regex: `^${value}`, $options: 'i' } };
      
      case 'endswith':
        return { [field]: { $regex: `${value}$`, $options: 'i' } };
      
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Convert simple filters array to MongoDB filter
   */
  static convertSimpleFilters(filters: Array<{field: string; operator: string; value: any}>): any {
    const mongoFilter: any = {};
    
    filters.forEach(filter => {
      const { field, operator, value } = filter;
      
      // Convert string to ObjectId for _id field
      let processedValue = value;
      if (field === '_id' && typeof value === 'string') {
        try {
          processedValue = new ObjectId(value);
        } catch (error) {
          // If conversion fails, keep original value
          processedValue = value;
        }
      }
      
      switch (operator) {
        case 'eq':
          mongoFilter[field] = processedValue;
          break;
        case 'neq':
          mongoFilter[field] = { $ne: processedValue };
          break;
        case 'gt':
          mongoFilter[field] = { $gt: processedValue };
          break;
        case 'gte':
          mongoFilter[field] = { $gte: processedValue };
          break;
        case 'lt':
          mongoFilter[field] = { $lt: processedValue };
          break;
        case 'lte':
          mongoFilter[field] = { $lte: processedValue };
          break;
        case 'in':
          mongoFilter[field] = { $in: processedValue };
          break;
        case 'nin':
          mongoFilter[field] = { $nin: processedValue };
          break;
        case 'like':
          const pattern = processedValue.replace(/%/g, '.*').replace(/_/g, '.');
          mongoFilter[field] = { $regex: pattern, $options: 'i' };
          break;
        case 'contains':
          mongoFilter[field] = { $regex: processedValue, $options: 'i' };
          break;
        case 'exists':
          mongoFilter[field] = { $exists: processedValue };
          break;
        case 'null':
          mongoFilter[field] = null;
          break;
        case 'notnull':
          mongoFilter[field] = { $ne: null };
          break;
        default:
          mongoFilter[field] = processedValue;
      }
    });
    
    return mongoFilter;
  }
}