import { FastifyReply, FastifyRequest } from 'fastify';

export function responseInterceptor(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: any,
    done: (err: Error | null, payload?: any) => void
) {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!payload?.is_err) {
        const wrapped = {
            message: "Success",
            statusCode: 200,
            data: payload,
        };
        done(null, JSON.stringify(wrapped));
    } else {
        payload.is_err = undefined;
        done(null, JSON.stringify(payload));
    }
}