import { AdapterErrors } from "../../errors/errorFactories";
import { AdapterRegistry } from "./adapterRegister";
import { AdapterPluginConfig, DatabaseAdapter } from "./types";

export class AdapterPluginSystem {
  private registry: AdapterRegistry;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry || AdapterRegistry.getInstance();
  }

  /**
   * Load adapter from module
   */
  async loadAdapter(modulePath: string): Promise<void> {
    try {
      const module = await import(modulePath);
      const AdapterClass = module.default || module;
      
      if (typeof AdapterClass !== 'function') {
        throw AdapterErrors.moduleInvalid(modulePath);
      }

      const adapter = new AdapterClass();
      
      if (!this.isValidAdapter(adapter)) {
        throw AdapterErrors.implementationInvalid(modulePath);
      }

      this.registry.register(adapter);
    } catch (error) {
      throw AdapterErrors.loadFailed(modulePath, (error as Error).message);
    }
  }

  /**
   * Load adapters from configuration
   */
  async loadAdaptersFromConfig(config: AdapterPluginConfig): Promise<void> {
    for (const adapterConfig of config.adapters) {
      try {
        if (adapterConfig.path) {
          await this.loadAdapter(adapterConfig.path);
        } else if (adapterConfig.package) {
          await this.loadAdapter(adapterConfig.package);
        }
      } catch (error) {
        if (adapterConfig.required) {
          throw error;
        }
        console.warn(`Optional adapter failed to load:`, error);
      }
    }
  }

  private isValidAdapter(obj: any): obj is DatabaseAdapter {
    return !!(obj &&
           typeof obj.name === 'string' &&
           typeof obj.type === 'string' &&
           typeof obj.version === 'string' &&
           typeof obj.convertQuery === 'function' &&
           typeof obj.executeQuery === 'function' &&
           typeof obj.validateQuery === 'function' &&
           typeof obj.getCapabilities === 'function' &&
           typeof obj.initialize === 'function' &&
           typeof obj.dispose === 'function' &&
           typeof obj.testConnection === 'function');
  }
}