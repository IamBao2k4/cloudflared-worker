import { FastifyInstance } from 'fastify';
import { EntityRoutes } from '../module/_entity/entity';
import { CommonRoutes } from '../module/common/common';
import { AuthRoutes } from '../module/auth/auth';

export async function IndexRoute(app: FastifyInstance) {
  // Health check route
  app.get('/health', async (request, reply) => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    };
  });

  // Test logging route
  app.get('/test-log', async (request, reply) => {
    return {
      message: 'This is a test log entry',
      timestamp: new Date().toISOString(),
      traceId: (request as any).traceId
    };
  });

  // Test error logging route
  app.get('/test-error', async (request, reply) => {
    throw new Error('This is a test error for logging');
  });

  await AuthRoutes(app);
  // await EntityRoutes(app);
  await CommonRoutes(app);
}