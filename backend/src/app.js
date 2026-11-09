const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const env = require('./config/env');
const AgentModel = require('./models/Agent');
const AgentService = require('./services/agentService');
const createAgentController = require('./controllers/agentController');
const createAgentRouter = require('./routes/agentRoutes');
const asyncHandler = require('./utils/asyncHandler');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * App factory. Dependencies are injected so tests can pass an in-memory Redis
 * (or a deliberately broken one) without touching module state.
 *
 * @param {{ cache: import('./services/cacheService') }} deps
 */
function createApp({ cache }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  // The server already caches in Redis; stop browsers/proxies from adding a second, uncontrolled layer.
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get(
    '/health',
    asyncHandler(async (req, res) => {
      const mongoUp = mongoose.connection.readyState === 1;
      const redisUp = await cache.isHealthy();
      res.status(mongoUp ? 200 : 503).json({
        status: mongoUp ? 'ok' : 'degraded',
        mongo: mongoUp ? 'up' : 'down',
        redis: cache.enabled ? (redisUp ? 'up' : 'down') : 'disabled',
      });
    })
  );

  const service = new AgentService({ AgentModel, cache });
  app.use('/api/agents', createAgentRouter(createAgentController(service)));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
