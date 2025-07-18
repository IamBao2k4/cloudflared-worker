
import { CoreBootstrap, createCoreSystem } from "../core/main/connect";
import { NewCore } from "../core/main/newCore";
import { EntityManager } from "../manager";
import { settingCore } from "./app-settings";

export let coreGlobal: CoreBootstrap;

export const InitialCore = async () => {
  try {
    console.log('🔄 Initializing CoreBootstrap...');
    coreGlobal = new CoreBootstrap();
    
    console.log('🔄 Initializing with config...');
    await coreGlobal.initializeWithConfig(settingCore);
    
    console.log('✅ Core initialized successfully');
    
    // Skip EntityManager in worker environment since it uses Node.js fs module
    console.log('⚠️ Skipping EntityManager in worker environment');
  } catch (error) {
    console.error('❌ Core initialization failed:', error);
    throw error;
  }
};


export const filterPassword = (obj: any) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.toLowerCase().includes('password')) {
        console.log(key)
        obj[key] = undefined;
      }
    }
  }
  return obj;
}