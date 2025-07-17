import { AdapterPluginSystem } from "../adapters/base/adapterPlugin";
import { adapterRegistry } from "../adapters/base/adapterRegister";
import { RelationshipRegistry } from "../adapters/base/relationship/RelationshipRegistry";
import { ElasticsearchAdapter } from "../adapters/elasticsearch/elasticsearchAdapter";
import { MongoDBAdapter } from "../adapters/mongodb/mongodbAdapter";
import { MySQLAdapter } from "../adapters/mysql/mysqlAdapter";
import { PostgreSQLAdapter } from "../adapters/postgresql/postgresqlAdapter";
import { ErrorCodes, wrapError } from "../errors";
import { BootstrapErrors } from "../errors/errorFactories";
import {
  BootstrapConfig,
  ConnectionTestResult,
  CustomAdapterConfig,
  SystemStatus,
} from "../types";
import { NewCore } from "./newCore";
import { CoreConfig } from "./types";

export class CoreBootstrap {
  private core?: NewCore;
  private pluginSystem: AdapterPluginSystem;
  public relationshipRegistry: RelationshipRegistry;

  constructor() {
    this.pluginSystem = new AdapterPluginSystem(adapterRegistry);
    this.relationshipRegistry = new RelationshipRegistry();
  }

  async initializeWithBuiltinAdapters(config?: CoreConfig): Promise<NewCore> {
    try {
      await this.registerBuiltinAdapters();
      this.core = new NewCore(this.relationshipRegistry, adapterRegistry);
      if (config) {
        await this.core.initialize(config);
      }
      return this.core;
    } catch (error) {
      throw BootstrapErrors.initBuiltinFailed(error);
    }
  }
  async initializeWithConfig(config: BootstrapConfig): Promise<NewCore> {
    if (!config) {
      throw BootstrapErrors.configRequired();
    }
    try {
      if (config.includeBuiltinAdapters !== false) {
        await this.registerBuiltinAdapters();
      }
      if (config.customAdapters) {
        await this.loadCustomAdapters(config.customAdapters);
      }
      if (config.relationships) {
        this.relationshipRegistry.registerBulk(config.relationships);
      } else if (config.includeBuiltinAdapters !== false) {
        console.warn("No relationships defined in configuration");
      }
      this.core = new NewCore(this.relationshipRegistry, adapterRegistry);
      if (config.core) {
        await this.core.initialize(config.core);
      }
      return this.core;
    } catch (error) {
      throw BootstrapErrors.initConfigFailed(error);
    }
  }

  getCore(): NewCore {
    if (!this.core) {
      throw BootstrapErrors.coreNotInitialized();
    }
    return this.core;
  }
  private async registerBuiltinAdapters(): Promise<void> {
    try {
      // Register MongoDB adapter
      const mongoAdapter = new MongoDBAdapter(this.relationshipRegistry);
      adapterRegistry.register(mongoAdapter);
      console.log("✅ MongoDB adapter registered");

      // Register PostgreSQL adapter
      const postgresAdapter = new PostgreSQLAdapter();
      adapterRegistry.register(postgresAdapter);
      console.log("✅ PostgreSQL adapter registered");

      // Register Elasticsearch adapter
      const elasticsearchAdapter = new ElasticsearchAdapter();
      adapterRegistry.register(elasticsearchAdapter);
      console.log("✅ Elasticsearch adapter registered");

      // Register MySQL adapter
      const mysqlAdapter = new MySQLAdapter();
      adapterRegistry.register(mysqlAdapter);
      console.log("✅ MySQL adapter registered");
    } catch (error) {
      console.error("❌ Failed to register built-in adapters:", error);
      throw wrapError(error, ErrorCodes.BST_INIT_BUILTIN_FAILED);
    }
  }
  private async loadCustomAdapters(
    customAdapters: CustomAdapterConfig[]
  ): Promise<void> {
    for (const adapterConfig of customAdapters) {
      try {
        if (adapterConfig.path) {
          await this.pluginSystem.loadAdapter(adapterConfig.path);
          console.log(`✅ Custom adapter loaded from: ${adapterConfig.path}`);
        } else if (adapterConfig.instance) {
          adapterRegistry.register(adapterConfig.instance);
          console.log(
            `✅ Custom adapter instance registered: ${adapterConfig.instance.name}`
          );
        }
      } catch (error) {
        if (adapterConfig.required) {
          throw wrapError(error, ErrorCodes.ADP_LOAD_FAILED);
        }
        console.warn(`⚠️ Optional custom adapter failed to load:`, error);
      }
    }
  }

  getStatus(): SystemStatus {
    const adapters = adapterRegistry.listAdapters();
    const relationships = this.relationshipRegistry.listAllRelationships();

    return {
      initialized: !!this.core,
      adapters: adapters.map((adapter) => ({
        name: adapter.name,
        type: adapter.type,
        version: adapter.version,
        capabilities: adapter.capabilities,
      })),
      relationships: Object.keys(relationships),
      supportedDatabaseTypes: adapterRegistry.getSupportedTypes(),
    };
  }

  async testConnections(): Promise<ConnectionTestResult[]> {
    try {
      const adapters = adapterRegistry.listAdapters();
      if (!Array.isArray(adapters)) {
        throw BootstrapErrors.adapterListFailed();
      }
      const results: ConnectionTestResult[] = [];

      for (const adapterInfo of adapters) {
        try {
          const adapter = adapterRegistry.getAdapter(
            adapterInfo.name,
            adapterInfo.version
          );
          if (adapter) {
            const connected = await adapter.testConnection();
            results.push({
              adapter: adapterInfo.name,
              type: adapterInfo.type,
              connected,
              error: connected ? undefined : "Connection test failed",
            });
          } else {
            results.push({
              adapter: adapterInfo.name,
              type: adapterInfo.type,
              connected: false,
              error: "Adapter not found",
            });
          }
        } catch (error) {
          results.push({
            adapter: adapterInfo.name,
            type: adapterInfo.type,
            connected: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return results;
    } catch (error) {
      throw BootstrapErrors.testConnectionFailed(error);
    }
  }
  async dispose(): Promise<void> {
    if (this.core) {
      await this.core.dispose();
    }
    await adapterRegistry.disposeAll();
  }
}
export async function createCoreSystem(
  config?: BootstrapConfig
): Promise<NewCore> {
  const bootstrap = new CoreBootstrap();
  if (config) {
    return bootstrap.initializeWithConfig(config);
  } else {
    return bootstrap.initializeWithBuiltinAdapters();
  }
}
