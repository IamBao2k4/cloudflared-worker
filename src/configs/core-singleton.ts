// Core singleton for Cloudflare Workers
import { CoreBootstrap } from '../core/main/connect';
import { settingCore } from './app-settings';

class CoreSingleton {
  private static instance: CoreSingleton;
  private core: CoreBootstrap | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  static getInstance(): CoreSingleton {
    if (!CoreSingleton.instance) {
      CoreSingleton.instance = new CoreSingleton();
    }
    return CoreSingleton.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.core = new CoreBootstrap();
      await this.core.initializeWithConfig(settingCore);
      this.initialized = true;
    } catch (error) {
      console.error('Core singleton initialization failed:', error);
      this.core = null;
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  getCore(): CoreBootstrap | null {
    return this.core;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const coreSingleton = CoreSingleton.getInstance();
