const asyncHandler = require('../utils/asyncHandler');
const {
  validateCreate,
  validateReplace,
  validatePatch,
  validateAgentId,
  validateListQuery,
} = require('../validators/agentValidator');

function createAgentController(service) {
  return {
    create: asyncHandler(async (req, res) => {
      const agent = await service.create(validateCreate(req.body));
      res.status(201).location(`/api/agents/${agent.agentId}`).json({ data: agent });
    }),

    list: asyncHandler(async (req, res) => {
      const { data, meta, cache } = await service.list(validateListQuery(req.query));
      res.set('X-Cache', cache).json({ data, meta });
    }),

    get: asyncHandler(async (req, res) => {
      const { data, cache } = await service.getById(validateAgentId(req.params.agentId));
      res.set('X-Cache', cache).json({ data });
    }),

    replace: asyncHandler(async (req, res) => {
      const agentId = validateAgentId(req.params.agentId);
      const agent = await service.update(agentId, validateReplace(req.body));
      res.json({ data: agent });
    }),

    patch: asyncHandler(async (req, res) => {
      const agentId = validateAgentId(req.params.agentId);
      const agent = await service.update(agentId, validatePatch(req.body));
      res.json({ data: agent });
    }),

    remove: asyncHandler(async (req, res) => {
      await service.remove(validateAgentId(req.params.agentId));
      res.status(204).end();
    }),
  };
}

module.exports = createAgentController;
