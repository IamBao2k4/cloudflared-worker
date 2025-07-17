import { IntermediateQuery, SortClause } from '../../../types/intermediateQuery';
import { FilterConverter } from './FilterConverter';
import { JoinConverter } from './JoinConverter';
import { MongoDBQuery } from '../types';
import { RelationshipRegistry } from '../../base/relationship/RelationshipRegistry';

export class QueryConverter {
  private joinConverter: JoinConverter;

  constructor(relationshipRegistry: RelationshipRegistry) {
    this.joinConverter = new JoinConverter(relationshipRegistry);
  }

  /**
   * Convert intermediate query to MongoDB query
   */
  convertQuery(query: IntermediateQuery): MongoDBQuery {
    switch (query.type) {
      case 'insert':
        return this.convertInsertQuery(query);
      case 'update':
        return this.convertUpdateQuery(query);
      case 'delete':
        return this.convertDeleteQuery(query);
      case 'read':
      default:
        return this.convertReadQuery(query);
    }
  }

  /**
   * Convert read query to MongoDB aggregation pipeline
   */
  private convertReadQuery(query: IntermediateQuery): any[] {
    const pipeline: any[] = [];
    // 1. Add lookup stages for joins first
    if (query.joins && query.joins.length > 0) {
      const lookupStages = this.joinConverter.convertJoins(query.joins, query.collection);
      
      pipeline.push(...lookupStages);
    }

    // 2. Add match stage for filters
    if (query.filter) {
      const matchStage = FilterConverter.convertFilter(query.filter);
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }
    } else if (query.filters && query.filters.length > 0) {
      const matchStage = FilterConverter.convertSimpleFilters(query.filters);
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }
    }

    // 3. Add projection stage
    if (query.select && query.select.fields && query.select.fields.length > 0) {
      const projection = this.convertProjection(query.select);
      if (Object.keys(projection).length > 0) {
        pipeline.push({ $project: projection });
      }
    }

    // 4. Add sort stage
    if (query.sort && query.sort.length > 0) {
      const sortStage = this.convertSort(query.sort);
      pipeline.push({ $sort: sortStage });
    }

    // 5. Add pagination stages
    if (query.pagination) {
      if (query.pagination.offset && query.pagination.offset > 0) {
        pipeline.push({ $skip: query.pagination.offset });
      }
      if (query.pagination.limit && query.pagination.limit > 0) {
        pipeline.push({ $limit: query.pagination.limit });
      }
    } else {
      if (query.skip && query.skip > 0) {
        pipeline.push({ $skip: query.skip });
      }
      if (query.limit && query.limit > 0) {
        pipeline.push({ $limit: query.limit });
      }
    }

    return pipeline;
  }

  /**
   * Convert insert query
   */
  private convertInsertQuery(query: IntermediateQuery): any {
    return {
      operation: 'insertOne',
      document: query.data
    };
  }

  /**
   * Convert update query
   */
  private convertUpdateQuery(query: IntermediateQuery): any {
    const filter = query.filters ? FilterConverter.convertSimpleFilters(query.filters) : {};
    
    return {
      operation: query.options?.partial ? 'updateOne' : 'replaceOne',
      filter,
      update: query.options?.partial ? { $set: query.data } : query.data
    };
  }

  /**
   * Convert delete query
   */
  private convertDeleteQuery(query: IntermediateQuery): any {
    const filter = query.filters ? FilterConverter.convertSimpleFilters(query.filters) : {};
    
    return {
      operation: 'deleteOne',
      filter
    };
  }

  /**
   * Convert select clause to MongoDB projection
   */
  private convertProjection(select: any): any {
    const projection: any = {};

    if (select.fields && select.fields.length > 0) {
      // Check if selecting all fields
      if (select.fields.includes('*')) {
        return {};
      }
      
      select.fields.forEach((field: string) => {
        if (field.includes('.')) {
          projection[field] = 1;
        } else {
          projection[field] = 1;
        }
      });
    }

    // Handle aliases
    if (select.aliases) {
      Object.entries(select.aliases).forEach(([alias, field]) => {
        projection[alias] = `$${field}`;
      });
    }

    return projection;
  }

  /**
   * Convert sort clauses to MongoDB sort object
   */
  private convertSort(sorts: SortClause[]): any {
    const sortObj: any = {};

    sorts.forEach(sort => {
      sortObj[sort.field] = sort.direction === 'desc' ? -1 : 1;
    });

    return sortObj;
  }
}