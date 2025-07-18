/**
 * Cloudflare Worker Entry Point
 * This file adapts the existing Fastify application to work with Cloudflare Workers
 * Using the same core system as the original application
 */

import { InitialCore, coreGlobal, filterPassword } from './configs/core-global';
import { appSettings } from './configs/app-settings';
import { commonService } from './module/common/common.service';
import { authService } from './module/auth/auth.service';
import './apm'

// Create a local CommonService that uses coreGlobal

// Declare global variables like in index.ts
declare global {
    var filterPassword: any;
}

global.filterPassword = filterPassword;

// Initialize services once
let isInitialized = false;

async function initializeWorker(env: any) {
    if (!isInitialized) {
        try {
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
            
            // Check if MongoDB URL is available before initializing
            if (!env.MONGODB_URL) {
                console.warn('⚠️ MONGODB_URL not provided, some features may not work');
                isInitialized = true; // Still mark as initialized to avoid repeated attempts
                return;
            }
            
            console.log('🔄 Initializing core system...');
            
            // Initialize core just like in index.ts
            await InitialCore();
            
            console.log('✅ Core system initialized successfully');
            
            isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize worker:', error);
            // Don't throw - just log and continue with limited functionality
            isInitialized = true; // Mark as initialized to prevent retry loops
        }
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
                if (!env.MONGODB_URL) {
                    return new Response(JSON.stringify({
                        error: 'MongoDB URL not configured',
                        message: 'Please set MONGODB_URL secret using: wrangler secret put MONGODB_URL'
                    }), { 
                        status: 503,
                        headers: corsHeaders 
                    });
                }

                try {
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

                    // Try to get core status only if MongoDB is configured
                    if (coreGlobal && env.MONGODB_URL) {
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
                    } else {
                        debugInfo['core_status'] = 'MongoDB not configured or core not available';
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
                const loginResult = await authService.login(request);
                return new Response(JSON.stringify(loginResult), { 
                    status: loginResult.success ? 200 : 401,
                    headers: corsHeaders 
                });
            }

            if (url.pathname === '/auth/me' && request.method === 'GET') {
                // Return user data like in original auth.ts
                const userData = await authService.getUserProfile();
                return new Response(JSON.stringify(userData), { headers: corsHeaders });
            }

            // Handle API routes with prefix
            if (url.pathname.startsWith(API_PREFIX + '/')) {
                // Check if MongoDB is configured
                if (!env.MONGODB_URL) {
                    return new Response(JSON.stringify({
                        error: 'Service Unavailable',
                        message: 'Database is not configured. Please set MONGODB_URL secret.',
                        hint: 'Use: wrangler secret put MONGODB_URL'
                    }), { 
                        status: 503,
                        headers: corsHeaders 
                    });
                }

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
                    switch (request.method) {
                        case 'GET':
                            if (entityId) {
                                // Get single entity by ID using core
                                const result = await commonService.findOne(entityName, queryParams, entityId, roles);
                                return new Response(JSON.stringify(result), { 
                                    status: 200, 
                                    headers: corsHeaders 
                                });
                            } else {
                                // Get all entities using core
                                const result = await commonService.findAllQuery(entityName, queryParams, roles);
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
