const mongoose = require('mongoose');
const env = require('./config/env');
const { connectMongo } = require('./config/db');
const { createRedisClient, waitForReady } = require('./config/redis');
const CacheService = require('./services/cacheService');
const createApp = require('./app');

async function main() {
  await connectMongo();
  console.log('[mongo] connected');

  let redis = null;
  if (env.cache.enabled) {
    redis = createRedisClient();
    const ready = await waitForReady(redis);
    console.log(ready ? '[redis] connected' : '[redis] not reachable yet - serving without cache until it is');
  } else {
    console.log('[redis] caching disabled via CACHE_ENABLED=false');
  }

  const cache = new CacheService(redis, env.cache);
  const app = createApp({ cache });
  const server = app.listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port}`));

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close();
    await Promise.allSettled([mongoose.disconnect(), redis ? redis.quit() : null]);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
