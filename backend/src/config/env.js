require('dotenv').config();

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/delivery_agents',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  cache: {
    enabled: (process.env.CACHE_ENABLED || 'true').toLowerCase() === 'true',
    prefix: process.env.CACHE_PREFIX || 'dams',
    detailTtl: int(process.env.CACHE_DETAIL_TTL_SECONDS, 300),
    listTtl: int(process.env.CACHE_LIST_TTL_SECONDS, 60),
  },
};
