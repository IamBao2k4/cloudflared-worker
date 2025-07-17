import { FastifyInstance, FastifyRequest } from 'fastify';
import { entityService } from './entity.service';

export async function EntityRoutes(app: FastifyInstance) {

  app.get('/entity', async (request, reply) => {
    const list = await entityService.getListEntity()
    return list;
  });

  app.get('/entity/:collection', async (request, reply) => {
    const { collection } = request.params as { collection: string; };
    return await entityService.getEntityByCollectionName(collection);
  });

  app.post('/entity', async (request, reply) => {
    console.log(request.body, "ccccccccccccccccccccccccccccccccc")
    return await entityService.createEntityFile(request.body);
  });

  app.put('/entity/:collection', async (request, reply) => {
    const { collection } = request.params as { collection: string; };
    return await entityService.updateEntityFile(collection, request.body);
  });

  app.delete('/entity/:collection', async (request, reply) => {
    const { collection } = request.params as { collection: string; };
    return await entityService.deleteEntityFile(collection);
  });

}