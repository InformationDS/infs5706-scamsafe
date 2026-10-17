export interface ServerConfig {
  mode: 'mock' | 'live';
  baseUrl: string;
  model: string;
  apiKey: string;
  authHeader: string;
  authScheme: string;
  timeoutMs: number;
  port: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mode = env.MODEL_MODE ?? 'mock';
  if (mode !== 'mock' && mode !== 'live') throw new Error('MODEL_MODE must be mock or live.');
  const port = Number(env.PORT ?? 4310);
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS ?? 30000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error('Invalid MODEL_TIMEOUT_MS.');
  const config: ServerConfig = {
    mode, port, timeoutMs,
    baseUrl: env.MODEL_BASE_URL?.trim() ?? '',
    model: env.MODEL_NAME?.trim() ?? '',
    apiKey: env.MODEL_API_KEY?.trim() ?? '',
    authHeader: env.MODEL_AUTH_HEADER?.trim() || 'Authorization',
    authScheme: env.MODEL_AUTH_SCHEME?.trim() ?? 'Bearer',
  };
  if (!['Authorization', 'api-key', 'x-api-key'].includes(config.authHeader)) throw new Error('Unsupported MODEL_AUTH_HEADER.');
  if (!/^[A-Za-z0-9_-]*$/.test(config.authScheme)) throw new Error('Invalid MODEL_AUTH_SCHEME.');
  if (config.baseUrl) {
    const url = new URL(config.baseUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
      throw new Error('MODEL_BASE_URL must use HTTPS (HTTP allowed only for loopback tests), without credentials, query or fragment.');
    }
  }
  return config;
}

export const isConfigured = (config: ServerConfig): boolean => Boolean(config.baseUrl && config.model && config.apiKey);
