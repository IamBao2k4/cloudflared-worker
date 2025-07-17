import { FastifyInstance } from "fastify";
import { commonService } from "./common.service";
import { ObjectId } from "mongodb";

export async function CommonRoutes(app: FastifyInstance) {
  // Get entity list
  app.get("/:entityName", async (request, reply) => {
    const { entityName } = request.params as { entityName: string };
    const queryData = request.query as any;
    const roles = request.headers["x-roles"] as string[] || ["user"];
    console.log(`Fetching data for entity: ${entityName} with roles: ${roles}`);
    const result = await commonService.findAllQuery(
      entityName,
      queryData,
      roles
    );
    console.log("Route handler - returning result.data with", result.data.length, "items");
    return result.data;
  });

  // Get entity details by id
  app.get("/:entityName/:id", async (request, reply) => {
    const { entityName, id } = request.params as {
      entityName: string;
      id: string;
    };
    const queryData = request.query as any;
    const roles = request.headers["x-roles"] as string[] || ["default"];
    return (await commonService.findOne(entityName, queryData, id, roles))?.data[0];
  });

  // Create new entity
  app.post("/:entityName", async (request, reply) => {
    const { entityName } = request.params as { entityName: string };
    const body = request.body;
    return await commonService.create(entityName, body);
  });

  // Update entity
  app.put("/:entityName/:id", async (request, reply) => {
    const { entityName, id } = request.params as {
      entityName: string;
      id: string;
    };
    const body = request.body;
    const roles = request.headers["x-roles"] as string[] || ["default"];
    return (await commonService.update(entityName, id, body, roles, "mongodb"));
  });

  // Partial update entity
  app.patch("/:entityName/:id", async (request, reply) => {
    const { entityName, id } = request.params as {
      entityName: string;
      id: string;
    };
    const body = request.body;
    const roles = request.headers["x-roles"] as string[] || ["default"];
    return await commonService.partialUpdate(entityName, id, body, roles, "mongodb");
  });

  // Delete entity
  app.delete("/:entityName/:id", async (request, reply) => {
    const { entityName, id } = request.params as {
      entityName: string;
      id: string;
    };
    const roles = request.headers["x-roles"] as string[] || ["default"];
    return await commonService.hardDelete(entityName, id, roles, "mongodb");
  });

}
