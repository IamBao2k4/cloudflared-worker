import { HttpError } from '../../utils/http-error';
import { coreGlobal } from '../../configs/core-global';
import { DatabaseType } from '../../core/adapters/base/types';
import { IntermediateQueryResult } from '../../core/types/intermediateQuery';

export interface PaginatedResult<T> {
    limit: number;
    skip: number;
    documents: T[];
    count: number;
}

class CommonService {

  LIST_ENTITY_WITHOUT_TENANT = [
    'user',
    'entity',
    'role',
  ]

  constructor() { 
    console.log('CommonService Initialized');
  }

  async findAllQuery(
    collectionName: string,
    queryData: any = {},
    roles: string[] = ['default'],
  ): Promise<IntermediateQueryResult<any>> {
    const relation = coreGlobal.relationshipRegistry.getForTable(collectionName)
    if (relation.length > 0) {
      if (queryData.select == undefined) {
        queryData.select = "*"
      }
      relation.forEach((item: any) => {
        
        queryData.select += `,${item.name}()`
      })
    }
    const result = coreGlobal.getCore().findAll(queryData as any, collectionName, roles, 'mongodb');
    return result;
  }
  
  async findOne(collectionName: string, queryData: any = {}, id: string, roles: string[] = ['default'], dbType: DatabaseType = 'mongodb'): Promise<IntermediateQueryResult<any> | null> {
    const relation = coreGlobal.relationshipRegistry.getForTable(collectionName)
    if (relation.length > 0) {
      if (queryData.select == undefined) {
        queryData.select = "*"
      }
      relation.forEach((item: any) => {
        
        queryData.select += `,${item.name}()`
      })
    }
    return coreGlobal.getCore().findById(
      collectionName,
      queryData,
      id,
      roles,
      dbType,
    )
  }

  async create(collectionName: string, createDto: any, roles: string[] = ['default'], dbType: DatabaseType = 'mongodb'): Promise<any> {
    return await coreGlobal.getCore().create(
      collectionName,
      createDto,
      roles,
      dbType
    );
  }

  async update(collectionName: string, id: string, body: any, roles: string[] = ['default'], dbType: DatabaseType = 'mongodb', _session?: any): Promise<any> {
    return await coreGlobal.getCore().update(
      collectionName,
      id,
      body,
      roles,
      dbType,
      _session
    );
  }

  async partialUpdate(collectionName: string, id: string, body: any, roles: string[] = ['default'], dbType: DatabaseType = 'mongodb', _session?: any): Promise<any> {
    return await coreGlobal.getCore().partialUpdate(
      collectionName,
      id,
      body,
      roles,
      dbType,
      _session
    );
  }

  async hardDelete(collectionName: string, id: string, roles: string[] = ['default'], dbType: DatabaseType = 'mongodb'): Promise<any> {
    return await coreGlobal.getCore().delete(
      collectionName,
      id,
      roles,
      dbType
    );
  }

}

export const commonService = new CommonService();
