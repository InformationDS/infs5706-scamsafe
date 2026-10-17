import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isConfigured, readConfig, type ServerConfig } from './config.js';
import { ApiError } from './model.js';

export const ModelSettingsInputSchema = z.object({
  mode: z.enum(['mock', 'live']).optional(),
  baseUrl: z.string().max(2048).optional(),
  model: z.string().max(200).optional(),
  apiKey: z.string().max(8192).optional(),
  clearApiKey: z.boolean().optional(),
  authHeader: z.enum(['Authorization', 'api-key', 'x-api-key']).optional(),
  authScheme: z.string().max(100).optional(),
  timeoutMs: z.number().int().min(100).max(120000).optional(),
}).strict();
export type ModelSettingsInput = z.infer<typeof ModelSettingsInputSchema>;
export type PublicModelSettings = Omit<ServerConfig, 'apiKey' | 'port'> & { hasApiKey: boolean };
type Options = { config: ServerConfig; filePath?: string; persist?: (config: ServerConfig) => void };

function validate(config: ServerConfig): ServerConfig {
  try {
    const checked = readConfig({ MODEL_MODE: config.mode, MODEL_BASE_URL: config.baseUrl,
      MODEL_NAME: config.model, MODEL_API_KEY: config.apiKey, MODEL_AUTH_HEADER: config.authHeader,
      MODEL_AUTH_SCHEME: config.authScheme, MODEL_TIMEOUT_MS: String(config.timeoutMs), PORT: String(config.port) });
    if (checked.mode === 'live' && !isConfigured(checked)) throw new Error();
    // Credentials become HTTP header values; reject line breaks and unsupported control characters locally.
    if (/[^\x20-\x7E]/.test(checked.apiKey)) throw new Error();
    return checked;
  } catch { throw new ApiError(400, 'INVALID_MODEL_SETTINGS', 'Check model mode, URL, model name, credentials, authentication and timeout. Live mode requires complete configuration.'); }
}

export class ModelSettingsStore {
  private config: ServerConfig;
  constructor(private readonly options: Options) {
    this.config = { ...options.config };
    if (options.filePath) {
      let stored: string;
      try { stored = readFileSync(options.filePath, 'utf8'); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw new Error('Local model settings could not be read. Check the local configuration file.');
      }
      try {
        const input = ModelSettingsInputSchema.parse(JSON.parse(stored));
        this.config = this.merge({ ...input, clearApiKey: input.apiKey !== undefined && !input.apiKey.trim() ? true : input.clearApiKey });
      } catch { throw new Error('Local model settings are invalid. Check the local configuration file.'); }
    }
  }
  getConfig(): ServerConfig { return { ...this.config }; }
  publicSettings(): PublicModelSettings {
    const { apiKey, port: _port, ...settings } = this.config;
    return { ...settings, hasApiKey: Boolean(apiKey) };
  }
  private merge(input: ModelSettingsInput): ServerConfig {
    const { apiKey, clearApiKey, ...fields } = input;
    if (clearApiKey && apiKey?.trim()) throw new ApiError(400, 'INVALID_MODEL_SETTINGS', 'Choose either a replacement credential or explicit credential removal.');
    return validate({ ...this.config, ...fields, apiKey: clearApiKey ? '' : apiKey?.trim() || this.config.apiKey });
  }
  save(raw: unknown): PublicModelSettings {
    const parsed = ModelSettingsInputSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, 'INVALID_MODEL_SETTINGS', 'Supply only supported model settings with valid field types.');
    const next = this.merge(parsed.data);
    let temporary: string | undefined;
    try {
      if (this.options.persist) this.options.persist({ ...next });
      else if (this.options.filePath) {
        const file = this.options.filePath;
        mkdirSync(dirname(file), { recursive: true });
        temporary = `${file}.${randomUUID()}.tmp`;
        const { port: _port, ...saved } = next;
        writeFileSync(temporary, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        renameSync(temporary, file);
      }
    } catch {
      if (temporary) { try { rmSync(temporary, { force: true }); } catch { /* Do not expose filesystem or credential details. */ } }
      throw new ApiError(503, 'SETTINGS_SAVE_FAILED', 'Model settings could not be saved. Previous settings are unchanged.', true);
    }
    this.config = next;
    return this.publicSettings();
  }
}
