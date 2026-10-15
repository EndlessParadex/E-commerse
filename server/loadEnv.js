import { existsSync } from 'node:fs';
export function loadLocalEnv() {
  if (existsSync('.env')) process.loadEnvFile('.env');
}
