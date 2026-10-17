export interface ModelSettingsSummary {
  mode: 'mock' | 'live';
  baseUrl: string;
  model: string;
  authHeader: 'Authorization' | 'api-key' | 'x-api-key';
  authScheme: string;
  timeoutMs: number;
  hasApiKey: boolean;
}

export interface ModelSettingsInput extends Omit<ModelSettingsSummary, 'hasApiKey'> {
  apiKey?: string;
  clearApiKey?: boolean;
}
