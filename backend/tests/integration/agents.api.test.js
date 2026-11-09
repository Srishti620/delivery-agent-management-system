const request = require('supertest');
const RedisMock = require('ioredis-mock');

const createApp = require('../../src/app');
const CacheService = require('../../src/services/cacheService');
const Agent = require('../../src/models/Agent');
const { startMongo } = require('../helpers/mongo');

const silent = { warn() {}, error() {}, info() {} };
const AGENT_ID = /^DA-[0-9A-F]{8}$/;

let mongo;
let redis;
let cache;
let app;

const payload = (n = 1, overrides = {}) => ({
  fullName: `Test Agent ${n}`,
  phoneNumber: `+9198765432${String(n).padStart(2, '0')}`,
  email: `agent${n}@example.com`,
  serviceArea: 'Kanpur',
  status: 'active',
  vehicleType: 'motorbike',
  ...overrides,
});

const createAgent = async (n = 1, overrides = {}) => {
  const res = await request(app).post('/api/agents').send(payload(n, overrides));
  expect(res.status).toBe(201);
  return res.body.data;
};

beforeAll(async () => {
  mongo = await startMongo();
  await Agent.syncIndexes(); 
  redis = new RedisMock();
  cache = new CacheService(redis, { prefix: 'test', detailTtl: 300, listTtl: 60, logger: silent });
  app = createApp({ cache });
});

afterAll(async () => {
  if (mongo) await mongo.stop();
  if (redis) redis.disconnect();
});

beforeEach(async () => {
  await Agent.deleteMany({});
  await redis.flushall();
});

describe('POST /api/agents (create)', () => {
  test('creates an agent and returns 201 with id, timestamps and Location', async () => {
    const res = await request(app).post('/api/agents').send(payload(1));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/agents/${res.body.data.agentId}`);
    expect(res.body.data).toMatchObject({
      fullName: 'Test Agent 1',
      phoneNumber: '+919876543201',
      email: 'agent1@example.com',
      serviceArea: 'Kanpur',
      status: 'active',
      vehicleType: 'motorbike',
    });
    expect(res.body.data.agentId).toMatch(AGENT_ID);
    expect(new Date(res.body.data.createdAt).getTime()).not.toBeNaN();
    expect(res.body.data.updatedAt).toBe(res.body.data.createdAt);
    expect(res.body.data._id).toBeUndefined();
  });

  test('applies defaults and normalises input', async () => {
    const res = await request(app).post('/api/agents').send({
      fullName: '  Ravi   Kumar ',
      phoneNumber: '98765 43210',
      email: 'RAVI@Example.COM',
      serviceArea: ' Lucknow ',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      fullName: 'Ravi Kumar',
      phoneNumber: '9876543210',
      email: 'ravi@example.com',
      serviceArea: 'Lucknow',
      status: 'active',
      vehicleType: 'none',
    });
  });

  test('ignores client-supplied agentId and timestamps', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send(payload(1, { agentId: 'DA-FFFFFFFF', createdAt: '2000-01-01T00:00:00.000Z' }));

    expect(res.status).toBe(201);
    expect(res.body.data.agentId).not.toBe('DA-FFFFFFFF');
    expect(res.body.data.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  test('returns 400 with per-field details when fields are missing', async () => {
    const res = await request(app).post('/api/agents').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'fullName', 'phoneNumber', 'serviceArea']);
  });

  test.each([
    ['email', { email: 'not-an-email' }],
    ['phoneNumber', { phoneNumber: '12345' }],
    ['status', { status: 'banned' }],
    ['vehicleType', { vehicleType: 'rocket' }],
    ['fullName', { fullName: 'A' }],
    ['serviceArea', { serviceArea: 42 }],
  ])('rejects an invalid %s', async (field, override) => {
    const res = await request(app).post('/api/agents').send(payload(1, override));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field })]);
  });

  test('rejects malformed JSON and non-object bodies with 400', async () => {
    const malformed = await request(app).post('/api/agents').set('Content-Type', 'application/json').send('{bad json');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.message).toMatch(/malformed json/i);

    const array = await request(app).post('/api/agents').send([payload(1)]);
    expect(array.status).toBe(400);
  });

  test('returns 409 for a duplicate email or phone number', async () => {
    await createAgent(1);

    const dupEmail = await request(app).post('/api/agents').send(payload(2, { email: 'agent1@example.com' }));
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error.message).toMatch(/email address already exists/);

    const dupPhone = await request(app).post('/api/agents').send(payload(3, { phoneNumber: '+919876543201' }));
    expect(dupPhone.status).toBe(409);
    expect(dupPhone.body.error.message).toMatch(/phone number already exists/);
  });
});

/* ------------------------------------------------------------------ */
describe('GET /api/agents/:agentId (read one)', () => {
  test('returns the agent', async () => {
    const created = await createAgent(1);
    const res = await request(app).get(`/api/agents/${created.agentId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(created);
  });

  test('accepts a lowercase id', async () => {
    const created = await createAgent(1);
    const res = await request(app).get(`/api/agents/${created.agentId.toLowerCase()}`);
    expect(res.status).toBe(200);
  });

  test('returns 404 with a clear message for an unknown agent', async () => {
    const res = await request(app).get('/api/agents/DA-00000000');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Delivery agent DA-00000000 was not found');
  });

  test('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/agents/not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/invalid agent id/i);
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe(404);
  });
});

describe('GET /api/agents (list)', () => {
  beforeEach(async () => {
    await createAgent(1, { fullName: 'Asha Rao', serviceArea: 'Kanpur', status: 'active' });
    await createAgent(2, { fullName: 'Bharat Das', serviceArea: 'Lucknow', status: 'inactive' });
    await createAgent(3, { fullName: 'Chitra Sen', serviceArea: 'Kanpur', status: 'on_leave' });
    await createAgent(4, { fullName: 'Dev Anand', serviceArea: 'Delhi', status: 'active' });
  });

  test('returns data plus pagination meta, newest first by default', async () => {
    const res = await request(app).get('/api/agents');

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 4, totalPages: 1 });
    expect(res.body.data.map((a) => a.fullName)).toEqual(['Dev Anand', 'Chitra Sen', 'Bharat Das', 'Asha Rao']);
  });

  test('paginates', async () => {
    const p1 = await request(app).get('/api/agents?limit=3&page=1');
    const p2 = await request(app).get('/api/agents?limit=3&page=2');

    expect(p1.body.data).toHaveLength(3);
    expect(p2.body.data).toHaveLength(1);
    expect(p1.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(p2.body.meta.page).toBe(2);
  });

  test('filters by status and by service area (case-insensitive)', async () => {
    const byStatus = await request(app).get('/api/agents?status=active');
    expect(byStatus.body.data.map((a) => a.fullName).sort()).toEqual(['Asha Rao', 'Dev Anand']);

    const byArea = await request(app).get('/api/agents?serviceArea=kanpur');
    expect(byArea.body.meta.total).toBe(2);

    const both = await request(app).get('/api/agents?serviceArea=Kanpur&status=on_leave');
    expect(both.body.data.map((a) => a.fullName)).toEqual(['Chitra Sen']);
  });

  test('searches name, email, phone and agent id; special characters are treated literally', async () => {
    const byName = await request(app).get('/api/agents?search=bharat');
    expect(byName.body.data.map((a) => a.fullName)).toEqual(['Bharat Das']);

    const byEmail = await request(app).get('/api/agents?search=agent3@');
    expect(byEmail.body.data.map((a) => a.fullName)).toEqual(['Chitra Sen']);

    const regexChars = await request(app).get('/api/agents?search=.*');
    expect(regexChars.status).toBe(200);
    expect(regexChars.body.data).toHaveLength(0);
  });

  test('sorts ascending and descending', async () => {
    const asc = await request(app).get('/api/agents?sort=fullName');
    expect(asc.body.data.map((a) => a.fullName)).toEqual(['Asha Rao', 'Bharat Das', 'Chitra Sen', 'Dev Anand']);

    const desc = await request(app).get('/api/agents?sort=-fullName');
    expect(desc.body.data[0].fullName).toBe('Dev Anand');
  });

  test.each([
    ['limit=0'],
    ['limit=1000'],
    ['page=abc'],
    ['page=0'],
    ['status=banned'],
    ['sort=password'],
    ['status[$ne]=active'],
  ])('rejects invalid query "%s" with 400', async (qs) => {
    const res = await request(app).get(`/api/agents?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});

/* ------------------------------------------------------------------ */
describe('PUT /api/agents/:agentId (full update)', () => {
  test('replaces all fields, bumps updatedAt, keeps id and createdAt', async () => {
    const created = await createAgent(1);
    await new Promise((r) => setTimeout(r, 25));

    const res = await request(app)
      .put(`/api/agents/${created.agentId}`)
      .send(payload(1, { fullName: 'Renamed Agent', serviceArea: 'Noida', status: 'inactive' }));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      agentId: created.agentId,
      fullName: 'Renamed Agent',
      serviceArea: 'Noida',
      status: 'inactive',
      createdAt: created.createdAt,
    });
    expect(new Date(res.body.data.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
  });

  test('resets vehicleType to "none" when omitted (true replacement)', async () => {
    const created = await createAgent(1, { vehicleType: 'van' });
    const { vehicleType, ...withoutVehicle } = payload(1);

    const res = await request(app).put(`/api/agents/${created.agentId}`).send(withoutVehicle);
    expect(res.status).toBe(200);
    expect(res.body.data.vehicleType).toBe('none');
  });

  test('requires every core field plus status', async () => {
    const created = await createAgent(1);
    const res = await request(app).put(`/api/agents/${created.agentId}`).send({ fullName: 'Only Name' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'phoneNumber', 'serviceArea', 'status']);
  });

  test('404 for a missing agent, 409 when taking another agent’s email', async () => {
    const missing = await request(app).put('/api/agents/DA-00000000').send(payload(1));
    expect(missing.status).toBe(404);

    const a = await createAgent(1);
    await createAgent(2);
    const clash = await request(app).put(`/api/agents/${a.agentId}`).send(payload(1, { email: 'agent2@example.com' }));
    expect(clash.status).toBe(409);
  });
});

describe('PATCH /api/agents/:agentId (partial update)', () => {
  test('updates only the supplied fields', async () => {
    const created = await createAgent(1);
    const res = await request(app).patch(`/api/agents/${created.agentId}`).send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ...created, status: 'inactive', updatedAt: expect.any(String) });
  });

  test('cannot change agentId', async () => {
    const created = await createAgent(1);
    const res = await request(app).patch(`/api/agents/${created.agentId}`).send({ agentId: 'DA-FFFFFFFF', status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.agentId).toBe(created.agentId);
  });

  test('400 for an empty body or an invalid value, 404 for a missing agent', async () => {
    const created = await createAgent(1);

    const empty = await request(app).patch(`/api/agents/${created.agentId}`).send({});
    expect(empty.status).toBe(400);

    const invalid = await request(app).patch(`/api/agents/${created.agentId}`).send({ email: 'nope' });
    expect(invalid.status).toBe(400);

    const missing = await request(app).patch('/api/agents/DA-00000000').send({ status: 'inactive' });
    expect(missing.status).toBe(404);
  });
});

describe('DELETE /api/agents/:agentId', () => {
  test('deletes the agent (204), then it is gone (404)', async () => {
    const created = await createAgent(1);

    const del = await request(app).delete(`/api/agents/${created.agentId}`);
    expect(del.status).toBe(204);
    expect(del.text).toBe('');

    expect((await request(app).get(`/api/agents/${created.agentId}`)).status).toBe(404);
    expect((await request(app).delete(`/api/agents/${created.agentId}`)).status).toBe(404);
    expect(await Agent.countDocuments()).toBe(0);
  });

  test('400 for a malformed id', async () => {
    expect((await request(app).delete('/api/agents/xyz')).status).toBe(400);
  });
});

describe('Redis caching and invalidation', () => {
  const detailKey = (id) => cache.detailKey(id);

  test('detail: MISS then HIT, key is stored with a TTL', async () => {
    const a = await createAgent(1);

    const first = await request(app).get(`/api/agents/${a.agentId}`);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(await redis.get(detailKey(a.agentId))).not.toBeNull();
    expect(await redis.ttl(detailKey(a.agentId))).toBeGreaterThan(0);

    const second = await request(app).get(`/api/agents/${a.agentId}`);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  test('detail: update (PUT and PATCH) evicts the cached entry, so the next read is fresh', async () => {
    const a = await createAgent(1);
    await request(app).get(`/api/agents/${a.agentId}`); // warm

    await request(app).patch(`/api/agents/${a.agentId}`).send({ status: 'inactive' }).expect(200);
    expect(await redis.get(detailKey(a.agentId))).toBeNull();
    const afterPatch = await request(app).get(`/api/agents/${a.agentId}`);
    expect(afterPatch.headers['x-cache']).toBe('MISS');
    expect(afterPatch.body.data.status).toBe('inactive');

    await request(app).put(`/api/agents/${a.agentId}`).send(payload(1, { fullName: 'Via Put' })).expect(200);
    const afterPut = await request(app).get(`/api/agents/${a.agentId}`);
    expect(afterPut.headers['x-cache']).toBe('MISS');
    expect(afterPut.body.data.fullName).toBe('Via Put');
  });

  test('detail: delete evicts the cached entry and the agent is no longer served', async () => {
    const a = await createAgent(1);
    await request(app).get(`/api/agents/${a.agentId}`); // warm
    expect(await redis.get(detailKey(a.agentId))).not.toBeNull();

    await request(app).delete(`/api/agents/${a.agentId}`).expect(204);
    expect(await redis.get(detailKey(a.agentId))).toBeNull();
    expect((await request(app).get(`/api/agents/${a.agentId}`)).status).toBe(404);
  });

  test('404 responses are never cached', async () => {
    await request(app).get('/api/agents/DA-00000000').expect(404);
    await request(app).get('/api/agents/DA-00000000').expect(404);
    expect(await redis.keys('test:agents:detail:*')).toHaveLength(0);
  });

  test('list: MISS then HIT; each distinct query gets its own entry', async () => {
    await createAgent(1);
    await createAgent(2, { status: 'inactive' });

    const all1 = await request(app).get('/api/agents');
    const all2 = await request(app).get('/api/agents');
    expect(all1.headers['x-cache']).toBe('MISS');
    expect(all2.headers['x-cache']).toBe('HIT');
    expect(all2.body).toEqual(all1.body);

    const filtered = await request(app).get('/api/agents?status=inactive');
    expect(filtered.headers['x-cache']).toBe('MISS');
    expect(filtered.body.data).toHaveLength(1);
    expect((await redis.keys('test:agents:list:v[0-9]*:*')).length).toBe(2);
  });

  test('list: query parameter order does not create duplicate entries', async () => {
    await createAgent(1);
    await request(app).get('/api/agents?status=active&limit=5');
    const swapped = await request(app).get('/api/agents?limit=5&status=active');
    expect(swapped.headers['x-cache']).toBe('HIT');
  });

  test('list: create invalidates cached lists', async () => {
    await createAgent(1);
    await request(app).get('/api/agents'); // warm
    expect((await request(app).get('/api/agents')).headers['x-cache']).toBe('HIT');

    await createAgent(2);
    const after = await request(app).get('/api/agents');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.meta.total).toBe(2);
  });

  test('list: update invalidates cached lists', async () => {
    const a = await createAgent(1);
    await request(app).get('/api/agents?status=active'); // warm

    await request(app).patch(`/api/agents/${a.agentId}`).send({ status: 'inactive' }).expect(200);
    const after = await request(app).get('/api/agents?status=active');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.data).toHaveLength(0);
  });

  test('list: delete invalidates cached lists', async () => {
    const a = await createAgent(1);
    await createAgent(2);
    await request(app).get('/api/agents'); // warm

    await request(app).delete(`/api/agents/${a.agentId}`).expect(204);
    const after = await request(app).get('/api/agents');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.data.map((x) => x.agentId)).not.toContain(a.agentId);
    expect(after.body.meta.total).toBe(1);
  });

  test('failed writes (validation / conflict / 404) leave the cache intact', async () => {
    const a = await createAgent(1);
    await request(app).get('/api/agents'); // warm list
    await request(app).get(`/api/agents/${a.agentId}`); // warm detail

    await request(app).post('/api/agents').send({}).expect(400);
    await request(app).post('/api/agents').send(payload(2, { email: 'agent1@example.com' })).expect(409);
    await request(app).patch('/api/agents/DA-00000000').send({ status: 'inactive' }).expect(404);

    expect((await request(app).get('/api/agents')).headers['x-cache']).toBe('HIT');
    expect((await request(app).get(`/api/agents/${a.agentId}`)).headers['x-cache']).toBe('HIT');
  });

  test('fail-open: with Redis down every endpoint still works (X-Cache: BYPASS)', async () => {
    const boom = async () => {
      throw new Error('redis down');
    };
    const brokenCache = new CacheService({ get: boom, set: boom, del: boom, incr: boom, ping: boom }, { logger: silent });
    const degraded = createApp({ cache: brokenCache });

    const created = await request(degraded).post('/api/agents').send(payload(1));
    expect(created.status).toBe(201);

    const id = created.body.data.agentId;
    const list = await request(degraded).get('/api/agents');
    expect(list.status).toBe(200);
    expect(list.headers['x-cache']).toBe('BYPASS');
    expect(list.body.data).toHaveLength(1);

    const one = await request(degraded).get(`/api/agents/${id}`);
    expect(one.status).toBe(200);
    expect(one.headers['x-cache']).toBe('BYPASS');

    await request(degraded).patch(`/api/agents/${id}`).send({ status: 'inactive' }).expect(200);
    await request(degraded).delete(`/api/agents/${id}`).expect(204);
  });

  test('CACHE_ENABLED=false style: a disabled cache always bypasses', async () => {
    const off = createApp({ cache: new CacheService(redis, { enabled: false, logger: silent }) });
    const a = await request(off).post('/api/agents').send(payload(1));
    const res = await request(off).get(`/api/agents/${a.body.data.agentId}`);
    expect(res.headers['x-cache']).toBe('BYPASS');
    expect(await redis.keys('*')).toHaveLength(0);
  });
});

describe('GET /health', () => {
  test('reports mongo and redis status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mongo: 'up', redis: 'up' });
  });
});
