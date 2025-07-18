import { FastifyInstance, FastifyRequest } from 'fastify';
import { authService } from './auth.service';

export async function AuthRoutes(app: FastifyInstance) {

    app.post('/auth/login', async (request: FastifyRequest) => authService.login(request));

    app.get('/auth/me', async (request: FastifyRequest) => {
        return authService.getUserProfile();
    });
}