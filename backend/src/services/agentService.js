const ApiError = require('../utils/ApiError');

const FIELD_LABELS = { email: 'email address', phoneNumber: 'phone number' };
const MAX_ID_ATTEMPTS = 3;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Shape returned to API clients (and stored in Redis). Never leaks Mongo internals (_id). */
function toDTO(doc) {
  return {
    agentId: doc.agentId,
    fullName: doc.fullName,
    phoneNumber: doc.phoneNumber,
    email: doc.email,
    serviceArea: doc.serviceArea,
    status: doc.status,
    vehicleType: doc.vehicleType,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const notFound = (agentId) => new ApiError(404, `Delivery agent ${agentId} was not found`);

const isDuplicateKey = (err) => err && err.code === 11000;
const duplicateField = (err) => Object.keys(err.keyPattern || err.keyValue || {})[0];

function conflictError(err) {
  const field = duplicateField(err);
  const label = FIELD_LABELS[field] || field || 'value';
  return new ApiError(409, `A delivery agent with this ${label} already exists`, [
    { field: field || 'unknown', message: `${label} is already in use` },
  ]);
}

function buildFilter({ status, serviceArea, search }) {
  const filter = {};
  if (status) filter.status = status;
  if (serviceArea) filter.serviceArea = new RegExp(`^${escapeRegex(serviceArea)}$`, 'i');
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ fullName: re }, { email: re }, { phoneNumber: re }, { agentId: re }];
  }
  return filter;
}

function buildSort(sort) {
  const dir = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return { [field]: dir, _id: dir }; // _id tie-breaker keeps pagination stable
}

class AgentService {
  constructor({ AgentModel, cache }) {
    this.Agent = AgentModel;
    this.cache = cache;
  }

  async create(data) {
    for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS; attempt += 1) {
      try {
        const doc = await this.Agent.create(data);
        await this.cache.invalidateAfterCreate();
        return toDTO(doc.toObject());
      } catch (err) {
        if (isDuplicateKey(err)) {
          if (duplicateField(err) === 'agentId') continue; // astronomically rare id collision: retry
          throw conflictError(err);
        }
        throw err;
      }
    }
    throw new ApiError(500, 'Could not allocate a unique agent id, please retry');
  }

  async list(query) {
    const cached = await this.cache.getList(query);
    if (cached.status === 'HIT') return { ...cached.value, cache: 'HIT' };

    const filter = buildFilter(query);
    const [docs, total] = await Promise.all([
      this.Agent.find(filter)
        .sort(buildSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.Agent.countDocuments(filter),
    ]);

    const result = {
      data: docs.map(toDTO),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
    if (cached.status === 'MISS') await this.cache.setList(cached.key, result);
    return { ...result, cache: cached.status };
  }

  async getById(agentId) {
    const cached = await this.cache.getDetail(agentId);
    if (cached.status === 'HIT') return { data: cached.value, cache: 'HIT' };

    const doc = await this.Agent.findOne({ agentId }).lean();
    if (!doc) throw notFound(agentId); // 404s are deliberately not cached
    const data = toDTO(doc);
    if (cached.status === 'MISS') await this.cache.setDetail(agentId, data);
    return { data, cache: cached.status };
  }

  async update(agentId, changes) {
    let doc;
    try {
      doc = await this.Agent.findOneAndUpdate({ agentId }, { $set: changes }, { new: true, runValidators: true, lean: true });
    } catch (err) {
      if (isDuplicateKey(err)) throw conflictError(err);
      throw err;
    }
    if (!doc) throw notFound(agentId);
    await this.cache.invalidateAfterUpdate(agentId);
    return toDTO(doc);
  }

  async remove(agentId) {
    const doc = await this.Agent.findOneAndDelete({ agentId }).lean();
    if (!doc) throw notFound(agentId);
    await this.cache.invalidateAfterDelete(agentId);
  }
}

module.exports = AgentService;
