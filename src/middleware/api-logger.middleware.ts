import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import ElasticsearchService from '../services/elasticsearch.service';
import { ApiLogData } from '../types/elasticsearch';

declare module 'fastify' {
  interface FastifyRequest {
    startTime: number;
    traceId: string;
  }
}

interface ApiLoggerOptions {
  elasticsearchService: ElasticsearchService;
  excludePaths?: string[];
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  logLevel?: 'all' | 'errors' | 'none';
  sensitiveHeaders?: string[];
}

export class ApiLoggerMiddleware {
  private elasticsearchService: ElasticsearchService;
  private options: Required<ApiLoggerOptions>;

  constructor(elasticsearchService: ElasticsearchService, options: Partial<ApiLoggerOptions> = {}) {
    this.elasticsearchService = elasticsearchService;
    this.options = {
      elasticsearchService,
      excludePaths: ['/health', '/metrics', '/favicon.ico', '/swagger', '/documentation'],
      includeRequestBody: true,
      includeResponseBody: false,
      logLevel: 'all',
      sensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
      ...options
    };
  }

  private shouldLogRequest(request: FastifyRequest): boolean {
    // Check if path should be excluded
    if (this.options.excludePaths.some(path => request.url.includes(path))) {
      return false;
    }

    // Check log level
    if (this.options.logLevel === 'none') {
      return false;
    }

    return true;
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.options.sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private extractUserId(request: FastifyRequest): string | undefined {
    try {
      // Try to extract user ID from JWT token
      if (request.headers.authorization) {
        const token = request.headers.authorization.replace('Bearer ', '');
        // You can decode JWT here if needed
        // const decoded = jwt.verify(token, process.env.SECRET_JWT);
        // return decoded.sub || decoded.userId;
      }

      // Try to extract from request user object (if set by auth middleware)
      if ('user' in request && typeof request.user === 'object' && request.user !== null) {
        return (request.user as any).id || (request.user as any).userId;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private createLogData(
    request: FastifyRequest,
    reply: FastifyReply,
    responseTime: number,
    payload?: any,
    error?: Error
  ): ApiLogData {
    const logData: ApiLogData = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.socket.remoteAddress || 'unknown',
      statusCode: reply.statusCode,
      responseTime,
      queryParams: request.query as Record<string, any>,
      headers: this.sanitizeHeaders(request.headers),
      appName: process.env.APP_NAME || 'MongoRest API',
      environment: process.env.NODE_ENV || 'development',
      traceId: request.traceId
    };

    // Add user ID if available
    const userId = this.extractUserId(request);
    if (userId) {
      logData.userId = userId;
    }

    // Add request body if enabled and present
    if (this.options.includeRequestBody && request.body) {
      logData.requestBody = request.body;
    }

    // Add response body if enabled
    if (this.options.includeResponseBody && payload) {
      logData.responseBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }

    // Add error information if present
    if (error) {
      logData.errorMessage = error.message;
      logData.statusCode = reply.statusCode || 500;
    }

    return logData;
  }

  public registerHooks(fastify: FastifyInstance): void {
    // Add debug logging
    const debugMode = process.env.NODE_ENV === 'development';
    
    // Hook to add trace ID and start time
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      request.startTime = Date.now();
      request.traceId = uuidv4();
      
      // Add trace ID to response headers for debugging
      reply.header('X-Trace-ID', request.traceId);
      
      if (debugMode && this.shouldLogRequest(request)) {
        console.log(`🔄 [${request.traceId}] ${request.method} ${request.url} - Started`);
      }
    });

    // Hook to log successful responses
    fastify.addHook('onSend', async (
      request: FastifyRequest,
      reply: FastifyReply,
      payload: any
    ) => {
      if (!this.shouldLogRequest(request)) {
        return;
      }

      // Skip logging if only errors should be logged and this is not an error
      if (this.options.logLevel === 'errors' && reply.statusCode < 400) {
        return;
      }

      const responseTime = Date.now() - request.startTime;
      const logData = this.createLogData(request, reply, responseTime, payload);

      if (debugMode && this.shouldLogRequest(request)) {
        const statusColor = reply.statusCode >= 400 ? '🔴' : '🟢';
        console.log(`${statusColor} [${request.traceId}] ${request.method} ${request.url} - ${reply.statusCode} (${responseTime}ms)`);
      }

      // Log to Elasticsearch asynchronously (don't wait)
      setImmediate(async () => {
        try {
          await this.elasticsearchService.indexLog(logData);
          if (debugMode && this.shouldLogRequest(request)) {
            console.log(`📤 [${request.traceId}] Log sent to Elasticsearch`);
          }
        } catch (error: any) {
          console.error(`❌ [${request.traceId}] Failed to send log to Elasticsearch:`, error.message);
        }
      });
    });

    // Hook to log errors
    fastify.addHook('onError', async (
      request: FastifyRequest,
      reply: FastifyReply,
      error: Error
    ) => {
      if (!this.shouldLogRequest(request)) {
        return;
      }

      const responseTime = Date.now() - request.startTime;
      const logData = this.createLogData(request, reply, responseTime, undefined, error);

      if (debugMode) {
        console.log(`🔴 [${request.traceId}] ERROR: ${error.message}`);
      }

      // Log to Elasticsearch asynchronously
      setImmediate(async () => {
        try {
          await this.elasticsearchService.indexLog(logData);
          if (debugMode) {
            console.log(`📤 [${request.traceId}] Error log sent to Elasticsearch`);
          }
        } catch (logError: any) {
          console.error(`❌ [${request.traceId}] Failed to send error log to Elasticsearch:`, logError.message);
        }
      });
    });
  }
}

export default ApiLoggerMiddleware;
