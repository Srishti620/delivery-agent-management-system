const Redis = require('ioredis');
const env = require('./env');

function createRedisClient(url = env.redisUrl) {
  const client = new Redis(url, {
    // Fail fast instead of queueing commands while Redis is down: the cache layer
    // treats any Redis error as "cache unavailable" and falls through to MongoDB.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  client.on('error', (err) => console.warn(`[redis] ${err.message}`));
  return client;
}

/** Resolves true once connected, or false if Redis is not ready within `timeoutMs`. */
function waitForReady(client, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (client.status === 'ready') return resolve(true);
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      client.off('ready', onReady);
      resolve(false);
    }, timeoutMs);
    client.once('ready', onReady);
  });
}

module.exports = { createRedisClient, waitForReady };
