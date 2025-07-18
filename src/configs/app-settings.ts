import { BootstrapConfig } from "../core/types";

export const appSettings = {
  appName: process.env.APP_NAME,
  development: false,
  timeZone: process.env.TIME_ZONE,
  timeZoneMongoDB: {
    createdAt: "created_at",
    updatedAt: "updated_at",
    getCurrentTime() {
      return new Date().toLocaleString("en-US", {
        timeZone: appSettings.timeZone,
      });
    },
    getCustomTime(time: string) {
      return new Date(time);
    },
  },
  port: process.env.PORT,
  prefixApi: process.env.PREFIX_API,
  corsOrigin: ["*"],
  mongo: {
    url: process.env.MONGODB_URL || "mongodb://localhost:27017/prototype_3",
    dbName: "test",
    options: "?tls=true&authSource=admin&replicaSet=mangoads-mongodb-2025",
    isReplicaSet: process.env.IS_REPLICA_SET === "true" ? true : false,
  },
};

export const settingCore: BootstrapConfig = {
  includeBuiltinAdapters: false, // Don't include built-in adapters automatically
  relationships: {
    // Your specific relationships for the complex query
    // user: [
    //   {
    //     name: "user_roles",
    //     targetTable: "role",
    //     localField: "role",
    //     foreignField: "_id",
    //     type: "one-to-many"
    //   }
    // ]
    // users: [
    //   {
    //     name: "product_reviews",
    //     targetTable: "product_reviews",
    //     localField: "_id",
    //     foreignField: "userId",
    //     type: "one-to-many",
    //   },
    // ],
    // product_reviews: [
    //   {
    //     name: "products",
    //     targetTable: "products",
    //     localField: "productId",
    //     foreignField: "_id",
    //     type: "one-to-one",
    //   },
    //   {
    //     name: "user",
    //     targetTable: "users",
    //     localField: "userId",
    //     foreignField: "_id",
    //     type: "one-to-one",
    //   },
    // ],
    // orders: [
    //   {
    //     name: "products",
    //     targetTable: "products",
    //     localField: "items.productId",
    //     foreignField: "_id",
    //     type: "many-to-many",
    //   }
    // ],
    // products: [
    //   {
    //     name: "categories",
    //     targetTable: "categories",
    //     localField: "_id",
    //     foreignField: "_id",
    //     type: "many-to-many",
    //     junction: {
    //       table: "product_categories",
    //       localKey: "productId",
    //       foreignKey: "categoryId",
    //     },
    //   },
    //   {
    //     name: "reviews",
    //     targetTable: "product_reviews",
    //     localField: "_id",
    //     foreignField: "productId",
    //     type: "one-to-many",
    //   },{
    //     name: "category",
    //     targetTable: "categories",
    //     localField: "primaryCategoryId",
    //     foreignField: "_id",
    //     type: "one-to-one",
    //   }
    // ],
    // categories: [
    //   {
    //     name: "children",
    //     targetTable: "categories",
    //     localField: "_id",
    //     foreignField: "parentId",
    //     type: "one-to-many",
    //   },
    //   {
    //     name: "parent",
    //     targetTable: "categories",
    //     localField: "parentId",
    //     foreignField: "_id",
    //     type: "many-to-one",
    //   },
    //   {
    //     name: "products",
    //     targetTable: "products",
    //     localField: "_id",
    //     foreignField: "_id",
    //     type: "many-to-many",
    //     junction: {
    //       table: "product_categories",
    //       localKey: "categoryId",
    //       foreignKey: "productId",
    //     },
    //   },
    // ],
  },
  core: {
    adapters: process.env.MONGODB_URL ? {
      mongodb: {
        connection: {
          connectionString: process.env.MONGODB_URL,
        },
      }
    } : {}
  },
};
