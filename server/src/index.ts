import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './config.js';

try {
  const config = readConfig();
  const server = createApp().listen(config.port, '127.0.0.1', () => {
    console.log(`ScamSafe foundation: http://127.0.0.1:${config.port} (local model settings available in the app)`);
  });
  server.on('error', () => { console.error('Local service could not start. Check the configured port.'); process.exitCode = 1; });
} catch {
  console.error('Local configuration is invalid. Check .env and local/model-settings.json against the runbook; credential values are never printed.');
  process.exitCode = 1;
}
