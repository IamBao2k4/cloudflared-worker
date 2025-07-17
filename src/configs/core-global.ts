import { CoreBootstrap, createCoreSystem } from "../core/main/connect";
import { NewCore } from "../core/main/newCore";
import { EntityManager } from "../manager";
import { settingCore } from "./app-settings";
import { coreSingleton } from "./core-singleton";

export let coreGlobal: CoreBootstrap;

export const InitialCore = async () => {
  await coreSingleton.initialize();
  coreGlobal = coreSingleton.getCore()!;
  
  if (coreGlobal && coreGlobal.relationshipRegistry) {
    const watching = await new EntityManager(coreGlobal.relationshipRegistry);
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