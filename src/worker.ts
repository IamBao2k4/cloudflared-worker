/**
 * Cloudflare Worker Entry Point
 * This file adapts the existing Fastify application to work with Cloudflare Workers
 * Using the same core system as the original application
 */

import { InitialCore, coreGlobal, filterPassword } from './configs/core-global';
import { appSettings } from './configs/app-settings';

// Create a local CommonService that uses coreGlobal
class CommonService {
    LIST_ENTITY_WITHOUT_TENANT = [
        'user',
        'entity',
        'role',
    ];

    constructor() { 
        console.log('CommonService Initialized for Workers');
    }

    async findAllQuery(
        collectionName: string,
        queryData: any = {},
        roles: string[] = ['default'],
    ): Promise<any> {
        try {
            const relation = coreGlobal.relationshipRegistry.getForTable(collectionName);
            if (relation.length > 0) {
                if (queryData.select == undefined) {
                    queryData.select = "*";
                }
                relation.forEach((item: any) => {
                    queryData.select += `,${item.name}()`;
                });
            }
            
            const result = await coreGlobal.getCore().findAll(queryData as any, collectionName, roles, 'mongodb');
            return result;
        } catch (error) {
            console.error(`❌ Error in findAllQuery for ${collectionName}:`, error);
            throw error;
        }
    }
    
    async findOne(collectionName: string, queryData: any = {}, id: string, roles: string[] = ['default']): Promise<any> {
        const relation = coreGlobal.relationshipRegistry.getForTable(collectionName);
        if (relation.length > 0) {
            if (queryData.select == undefined) {
                queryData.select = "*";
            }
            relation.forEach((item: any) => {
                queryData.select += `,${item.name}()`;
            });
        }
        return coreGlobal.getCore().findById(
            collectionName,
            queryData,
            id,
            roles,
            'mongodb',
        );
    }

    async create(collectionName: string, createDto: any, roles: string[] = ['default']): Promise<any> {
        return await coreGlobal.getCore().create(
            collectionName,
            createDto,
            roles,
            'mongodb'
        );
    }

    async update(collectionName: string, id: string, body: any, roles: string[] = ['default']): Promise<any> {
        return await coreGlobal.getCore().update(
            collectionName,
            id,
            body,
            roles,
            'mongodb'
        );
    }

    async partialUpdate(collectionName: string, id: string, body: any, roles: string[] = ['default']): Promise<any> {
        return await coreGlobal.getCore().partialUpdate(
            collectionName,
            id,
            body,
            roles,
            'mongodb'
        );
    }

    async hardDelete(collectionName: string, id: string, roles: string[] = ['default']): Promise<any> {
        return await coreGlobal.getCore().delete(
            collectionName,
            id,
            roles,
            'mongodb'
        );
    }
}

// Declare global variables like in index.ts
declare global {
    var filterPassword: any;
}

global.filterPassword = filterPassword;

// Initialize services once
let isInitialized = false;
let commonService: CommonService;

async function initializeWorker(env: any) {
    if (!isInitialized) {
        console.log('🔧 Initializing Cloudflare Worker...');
        
        // Set environment variables for the core system
        if (!globalThis.process) {
            globalThis.process = { env: {} } as any;
        }
        
        // Map Cloudflare Workers env to process.env for compatibility
        globalThis.process.env = {
            APP_NAME: env.APP_NAME || 'MongoRest API',
            TIME_ZONE: env.TIME_ZONE || 'Asia/Ho_Chi_Minh',
            PORT: env.PORT || '3000',
            PREFIX_API: env.PREFIX_API || '/api/v1',
            MONGODB_URL: env.MONGODB_URL,
            ELASTICSEARCH_ENABLED: env.ELASTICSEARCH_ENABLED || 'false',
            SECRET_JWT: env.SECRET_JWT,
            IS_REPLICA_SET: 'true'
        };
        
        console.log('📡 Initializing core system with MongoDB URL:', env.MONGODB_URL ? 'Connected' : 'Not provided');
        
        // Initialize core just like in index.ts
        await InitialCore();
        
        // Now initialize core with proper adapter configuration
        const coreConfig = {
            adapters: {
                mongodb: {
                    connection: {
                        connectionString: env.MONGODB_URL || "mongodb://localhost:27017/test"
                    }
                }
            }
        };
        
        console.log('🔧 Initializing core with config:', coreConfig);
        await coreGlobal.getCore().initialize(coreConfig);
        
        // Initialize common service
        commonService = new CommonService();
        
        isInitialized = true;
        console.log('✅ Worker initialized successfully');
    }
}

export default {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        // Initialize worker on first request
        await initializeWorker(env);

        const url = new URL(request.url);
        
        // Get configuration from environment variables (same as original)
        const API_PREFIX = env.PREFIX_API || appSettings.prefixApi || '/api/v1';
        const APP_NAME = env.APP_NAME || 'MongoRest API';
        const TIME_ZONE = env.TIME_ZONE || 'Asia/Ho_Chi_Minh';
        const SECRET_JWT = env.SECRET_JWT || 'supersecret';
        const MONGODB_URL = env.MONGODB_URL;
        const ELASTICSEARCH_ENABLED = env.ELASTICSEARCH_ENABLED === 'true';
        
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-roles',
            'Content-Type': 'application/json',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Root endpoint
            if (url.pathname === '/') {
                return new Response(JSON.stringify({
                    message: 'Cloudflare Worker is running!',
                    app_name: APP_NAME,
                    timestamp: new Date().toISOString(),
                    environment: 'cloudflare-workers',
                    version: '1.0.0',
                    config: {
                        api_prefix: API_PREFIX,
                        timezone: TIME_ZONE,
                        elasticsearch_enabled: ELASTICSEARCH_ENABLED,
                        mongodb_connected: !!MONGODB_URL,
                        jwt_configured: !!SECRET_JWT
                    }
                }), { headers: corsHeaders });
            }

            // Health check
            if (url.pathname === '/health') {
                return new Response(JSON.stringify({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    environment: 'cloudflare-workers',
                    core_initialized: isInitialized,
                    mongodb_url_available: !!env.MONGODB_URL,
                    core_available: !!coreGlobal
                }), { headers: corsHeaders });
            }

            // Test MongoDB connection endpoint
            if (url.pathname === '/test-mongodb') {
                try {
                    console.log('🧪 Testing MongoDB connection...');
                    
                    // Try to get the core and adapter
                    const core = coreGlobal.getCore();
                    const adapter = core.getAdapter('mongodb');
                    
                    // Try to test connection
                    const connectionTest = await adapter.testConnection();
                    
                    return new Response(JSON.stringify({
                        mongodb_connection_test: connectionTest,
                        adapter_available: !!adapter,
                        adapter_name: adapter.name,
                        timestamp: new Date().toISOString()
                    }), { headers: corsHeaders });
                    
                } catch (error) {
                    console.error('MongoDB test error:', error);
                    return new Response(JSON.stringify({
                        error: 'MongoDB Test Failed',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined
                    }), { 
                        status: 500,
                        headers: corsHeaders 
                    });
                }
            }
            if (url.pathname === '/debug') {
                try {
                    const debugInfo: any = {
                        initialized: isInitialized,
                        mongodb_url_available: !!env.MONGODB_URL,
                        core_global_available: !!coreGlobal,
                        common_service_available: !!commonService,
                        process_env_available: !!globalThis.process?.env,
                        mongodb_url_in_process: globalThis.process?.env?.MONGODB_URL ? 'SET' : 'NOT_SET'
                    };

                    // Try to get core status
                    if (coreGlobal) {
                        try {
                            const core = coreGlobal.getCore();
                            debugInfo['core_instance'] = !!core;
                            
                            // Try to get adapter
                            try {
                                const adapter = core.getAdapter('mongodb');
                                debugInfo['mongodb_adapter'] = !!adapter;
                                debugInfo['adapter_name'] = adapter?.name || 'unknown';
                            } catch (e) {
                                debugInfo['mongodb_adapter_error'] = e instanceof Error ? e.message : 'Unknown error';
                            }
                        } catch (e) {
                            debugInfo['core_error'] = e instanceof Error ? e.message : 'Unknown error';
                        }
                    }

                    return new Response(JSON.stringify(debugInfo, null, 2), { 
                        headers: corsHeaders 
                    });
                } catch (error) {
                    return new Response(JSON.stringify({
                        debug_error: error instanceof Error ? error.message : 'Unknown debug error'
                    }), { 
                        headers: corsHeaders 
                    });
                }
            }

            // Authentication routes
            if (url.pathname === '/auth/login' && request.method === 'POST') {
                const body = await request.json() as { email: string; password: string };
                const { email, password } = body;
                
                if (email === 'tiennt1242@gmail.com' && password === 'tiennt1242@gmail.com') {
                    const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MTFlOGE0N2I0NWIyOTc0YmQ2MTMzYyIsImVtYWlsIjoiYWRtaW4yMDI0QGdtYWlsLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4yMDI0QGdtYWlsLmNvbSIsInBob25lIjoiODQ1NTkzMzAwNzIiLCJyb2xlX3N5c3RlbSI6ImFkbWluIiwiaWF0IjoxNzUxMzUzMjQ0LCJleHAiOjE3NTE0Mzk2NDR9.LwXXoDQ-kxcdIZfYPkfoAdGELRpbPZ64gQCgP42-lR8';
                    return new Response(JSON.stringify({ success: true, accessToken }), { 
                        headers: corsHeaders 
                    });
                } else {
                    return new Response(JSON.stringify({ 
                        success: false, 
                        message: 'Invalid credentials' 
                    }), { 
                        status: 401, 
                        headers: corsHeaders 
                    });
                }
            }

            if (url.pathname === '/auth/me' && request.method === 'GET') {
                // Return user data like in original auth.ts
                const userData = {
                    "_id": "6711e8a47b45b2974bd6133c",
                    "email": "admin2024@gmail.com",
                    "username": "admin2024@gmail.com",
                    "phone": "84559330072",
                    "is_active": true,
                    "role_system": "admin",
                    "created_at": "2024-09-12T06:45:23.353Z",
                    "updated_at": "2025-05-28T13:33:37.000Z",
                    "role": [
                        {
                            "title": "2bds",
                            "permission": [
                                {
                                    "title": "Post",
                                    "entity": "post",
                                    "filter": ["get-all", "get-all-self", "get", "get-self", "post", "put", "put-self", "delete"],
                                    "access_field": []
                                },
                                {
                                    "title": "category", 
                                    "entity": "category",
                                    "filter": ["get-all", "get-all-self", "get", "get-self", "post", "put", "put-self", "delete"],
                                    "access_field": []
                                }
                            ]
                        }
                    ]
                };
                
                return new Response(JSON.stringify(userData), { headers: corsHeaders });
            }

            // Handle API routes with prefix
            if (url.pathname.startsWith(API_PREFIX + '/')) {
                const pathWithoutPrefix = url.pathname.substring(API_PREFIX.length + 1);
                const pathParts = pathWithoutPrefix.split('/');
                const entityName = pathParts[0];
                const entityId = pathParts[1];
                
                // Extract query parameters
                const queryParams: any = {};
                url.searchParams.forEach((value, key) => {
                    if (!isNaN(Number(value))) {
                        queryParams[key] = Number(value);
                    } else if (value === 'true' || value === 'false') {
                        queryParams[key] = value === 'true';
                    } else {
                        queryParams[key] = value;
                    }
                });

                // Extract roles from headers
                const roles = request.headers.get('x-roles')?.split(',').map(r => r.trim()) || ['default'];

                try {
                    console.log(`API Request: ${request.method} ${url.pathname}`, {
                        entityName,
                        entityId,
                        roles,
                        queryParams
                    });

                    switch (request.method) {
                        case 'GET':
                            if (entityId) {
                                // Get single entity by ID using core
                                console.log(`Calling findOne for ${entityName} with id ${entityId}`);
                                const result = await commonService.findOne(entityName, queryParams, entityId, roles);
                                console.log('findOne result:', result);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            } else {
                                // Get all entities using core
                                console.log(`Calling findAllQuery for ${entityName}`);
                                const result = await commonService.findAllQuery(entityName, queryParams, roles);
                                console.log('findAllQuery result:', result);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            }

                        case 'POST':
                            if (!entityId) {
                                // Create new entity using core
                                const createData = await request.json();
                                const result = await commonService.create(entityName, createData, roles);
                                return new Response(JSON.stringify(result), { 
                                    status: 201, 
                                    headers: corsHeaders 
                                });
                            }
                            break;

                        case 'PUT':
                            if (entityId) {
                                // Full update entity using core
                                const updateData = await request.json();
                                const result = await commonService.update(entityName, entityId, updateData, roles);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            }
                            break;

                        case 'PATCH':
                            if (entityId) {
                                // Partial update entity using core
                                const patchData = await request.json();
                                const result = await commonService.partialUpdate(entityName, entityId, patchData, roles);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            }
                            break;

                        case 'DELETE':
                            if (entityId) {
                                // Delete entity using core
                                const result = await commonService.hardDelete(entityName, entityId, roles);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            }
                            break;

                        default:
                            return new Response(JSON.stringify({
                                error: 'Method Not Allowed',
                                message: `Method ${request.method} not supported`
                            }), { 
                                status: 405, 
                                headers: corsHeaders 
                            });
                    }
                } catch (error) {
                    console.error('API Error:', error);
                    return new Response(JSON.stringify({
                        error: 'Internal Server Error',
                        message: error instanceof Error ? error.message : 'Unknown error'
                    }), { 
                        status: 500, 
                        headers: corsHeaders 
                    });
                }
            }

            // Default 404 response
            return new Response(JSON.stringify({
                error: 'Not Found',
                path: url.pathname,
                message: 'Endpoint not found'
            }), { 
                status: 404, 
                headers: corsHeaders 
            });

        } catch (error) {
            console.error('Worker Error:', error);
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};
