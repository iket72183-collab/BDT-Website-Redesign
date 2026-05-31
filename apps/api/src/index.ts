import 'dotenv/config';
import { createServer } from './server.js';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';

const app = createServer();

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'API listening');
});
