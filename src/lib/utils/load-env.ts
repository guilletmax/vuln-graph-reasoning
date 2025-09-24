import fs from "node:fs";
import path from "node:path";

const ENV_CACHE_KEY = Symbol.for("mindfort.env.loaded");
const globalSymbols = Object.getOwnPropertySymbols(globalThis);
const alreadyLoaded = globalSymbols.some((symbol) => symbol === ENV_CACHE_KEY);

if (!alreadyLoaded) {
  Object.defineProperty(globalThis, ENV_CACHE_KEY, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  const envFile = process.env.ENV_FILE ?? ".env";
  const envPath = path.isAbsolute(envFile)
    ? envFile
    : path.join(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    try {
      const contents = fs.readFileSync(envPath, "utf-8");
      for (const line of contents.split(/\r?\n/)) {
        if (!line || line.trim().startsWith("#")) continue;
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) continue;
        const key = line.slice(0, eqIndex).trim();
        if (!key) continue;
        let value = line.slice(eqIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      console.warn(`Failed to load env file at ${envPath}`, error);
    }
  }
}
