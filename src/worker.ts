import { IndexRoute } from './routes/_index';
import { coreSingleton } from './configs/core-singleton';

// Mock Fastify class for Cloudflare Workers
class MockFastify {
  private routes: Array<{ method: string; pattern: string; handler: Function }> = [];
  private currentPrefix = '';

  async register(plugin: Function, options?: { prefix?: string }) {
    const oldPrefix = this.currentPrefix;
    if (options?.prefix) {
      this.currentPrefix = options.prefix;
    }
    await plugin(this);
    this.currentPrefix = oldPrefix;
  }

  get(pattern: string, handler: Function) {
    this.routes.push({ method: 'GET', pattern: this.currentPrefix + pattern, handler });
  }

  post(pattern: string, handler: Function) {
    this.routes.push({ method: 'POST', pattern: this.currentPrefix + pattern, handler });
  }

  put(pattern: string, handler: Function) {
    this.routes.push({ method: 'PUT', pattern: this.currentPrefix + pattern, handler });
  }

  delete(pattern: string, handler: Function) {
    this.routes.push({ method: 'DELETE', pattern: this.currentPrefix + pattern, handler });
  }

  patch(pattern: string, handler: Function) {
    this.routes.push({ method: 'PATCH', pattern: this.currentPrefix + pattern, handler });
  }

  findRoute(method: string, path: string) {
    return this.routes.find(route => {
      if (route.method !== method) return false;
      const pattern = route.pattern.replace(/:\w+/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    });
  }

  extractParams(pattern: string, path: string) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    const params: Record<string, string> = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      }
    }
    
    return params;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    
    const route = this.findRoute(method, path);
    
    if (route) {
      try {
        const params = this.extractParams(route.pattern, path);
        
        let headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        let body: any = {};
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const contentType = request.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            try {
              body = await request.json();
            } catch {
              body = {};
            }
          } else {
            try {
              const text = await request.text();
              body = text ? { data: text } : {};
            } catch {
              body = {};
            }
          }
        }
        
        const mockRequest = {
          method,
          url: request.url,
          headers,
          body,
          params,
          query: Object.fromEntries(url.searchParams.entries())
        };
        
        const mockReply = {
          statusCode: 200,
          code: function(status: number) { 
            this.statusCode = status; 
            return this; 
          },
          send: (data: any) => data,
          header: (name: string, value: string) => mockReply
        };
        
        const result = await route.handler(mockRequest, mockReply);
        
        return new Response(JSON.stringify(result), {
          status: mockReply.statusCode || 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

let app: MockFastify;
let initialized = false;

async function initializeWorker() {
  if (initialized) return;
  
  app = new MockFastify();
  
  // Basic route
  app.get('/', async () => ({
    message: 'MongoRest API Worker',
    version: '1.0.0',
    status: 'running'
  }));
  
  // Initialize Core and setup routes
  try {
    await coreSingleton.initialize();
    
    await app.register(async function (fastify: any) {
      await IndexRoute(fastify);
    }, { prefix: '/api/v1' });
    
  } catch (coreError) {
    // Fallback error route
    app.get('/api/v1/status', async () => ({
      status: 'error',
      message: 'Core initialization failed',
      error: coreError instanceof Error ? coreError.message : 'Unknown error'
    }));
  }
  
  initialized = true;
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    try {
      // Set environment variables from Cloudflare Worker env
      process.env.NODE_ENV = env.NODE_ENV || 'production';
      process.env.PREFIX_API = env.PREFIX_API || '/api/v1';
      process.env.TIME_ZONE = env.TIME_ZONE || 'UTC';
      process.env.PORT = env.PORT || '3000';
      process.env.APP_NAME = env.APP_NAME || 'MongoRest API';
      process.env.ELASTICSEARCH_INDEX = env.ELASTICSEARCH_INDEX || 'api-logs';
      process.env.ELASTICSEARCH_ENABLED = env.ELASTICSEARCH_ENABLED || 'false';
      process.env.MONGODB_URL = env.MONGODB_URL;

      if (!initialized) {
        await initializeWorker();
      }

      return await app.handleRequest(request);
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Worker Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
