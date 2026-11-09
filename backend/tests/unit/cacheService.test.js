const RedisMock = require('ioredis-mock');
const CacheService = require('../../src/services/cacheService');

const silent = { warn() {}, error() {}, info() {} };
const agent = { agentId: 'DA-00000001', fullName: 'Asha Rao' };

let redis;
let cache;

beforeEach(async () => {
  redis = new RedisMock();
  await redis.flushall();
  cache = new CacheService(redis, { prefix: 't', detailTtl: 300, listTtl: 60, logger: silent });
});

afterEach(() => redis.disconnect());

describe('detail entries', () => {
  test('MISS, then HIT after set, stored with the configured TTL', async () => {
    expect((await cache.getDetail(agent.agentId)).status).toBe('MISS');

    expect(await cache.setDetail(agent.agentId, agent)).toBe(true);
    const hit = await cache.getDetail(agent.agentId);
    expect(hit).toEqual({ status: 'HIT', value: agent });

    const ttl = await redis.ttl(cache.detailKey(agent.agentId));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  test('update and delete evict the entry', async () => {
    await cache.setDetail(agent.agentId, agent);
    await cache.invalidateAfterUpdate(agent.agentId);
    expect((await cache.getDetail(agent.agentId)).status).toBe('MISS');

    await cache.setDetail(agent.agentId, agent);
    await cache.invalidateAfterDelete(agent.agentId);
    expect((await cache.getDetail(agent.agentId)).status).toBe('MISS');
  });

  test('create does not touch detail entries', async () => {
    await cache.setDetail(agent.agentId, agent);
    await cache.invalidateAfterCreate();
    expect((await cache.getDetail(agent.agentId)).status).toBe('HIT');
  });
});

describe('list entries', () => {
  const query = { page: 1, limit: 10, sort: '-createdAt' };
  const page = { data: [agent], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };

  test('MISS returns a key; after setList the same query is a HIT with a TTL', async () => {
    const miss = await cache.getList(query);
    expect(miss.status).toBe('MISS');
    await cache.setList(miss.key, page);

    const hit = await cache.getList(query);
    expect(hit).toMatchObject({ status: 'HIT', value: page, key: miss.key });
    expect(await redis.ttl(miss.key)).toBeGreaterThan(0);
  });

  test('keys ignore property order and undefined values but differ per query', () => {
    expect(cache.listKey('1', { a: 1, b: 2 })).toBe(cache.listKey('1', { b: 2, c: undefined, a: 1 }));
    expect(cache.listKey('1', { a: 1 })).not.toBe(cache.listKey('1', { a: 2 }));
    expect(cache.listKey('1', { a: 1 })).not.toBe(cache.listKey('2', { a: 1 }));
  });

  test.each([
    ['create', () => cache.invalidateAfterCreate()],
    ['update', () => cache.invalidateAfterUpdate(agent.agentId)],
    ['delete', () => cache.invalidateAfterDelete(agent.agentId)],
  ])('%s makes every previously cached list unreachable', async (_name, invalidate) => {
    const q1 = { page: 1 };
    const q2 = { page: 2 };
    for (const q of [q1, q2]) {
      const miss = await cache.getList(q);
      await cache.setList(miss.key, page);
      expect((await cache.getList(q)).status).toBe('HIT');
    }

    await invalidate();

    expect((await cache.getList(q1)).status).toBe('MISS');
    expect((await cache.getList(q2)).status).toBe('MISS');
  });

  test('a result computed before a concurrent write can never be served afterwards', async () => {
    const before = await cache.getList(query); // reader looks up the cache (MISS) and starts a DB query...
    await cache.invalidateAfterCreate(); //        ...a write commits and bumps the version meanwhile...
    await cache.setList(before.key, { ...page, stale: true }); // ...then the reader stores its now-stale result

    const after = await cache.getList(query);
    expect(after.status).toBe('MISS'); // stale entry sits under the old version key, never read
  });

  test('the version counter is seeded from the clock and incremented on writes', async () => {
    const v1 = Number(await cache._listVersion());
    expect(v1).toBeGreaterThan(1e12);
    await cache.invalidateAfterCreate();
    expect(Number(await cache._listVersion())).toBe(v1 + 1);
  });
});

describe('failure modes', () => {
  test('fail-open when Redis errors: reads BYPASS, writes and invalidations never throw', async () => {
    const boom = async () => {
      throw new Error('redis down');
    };
    const broken = new CacheService({ get: boom, set: boom, del: boom, incr: boom, ping: boom }, { logger: silent });

    expect((await broken.getDetail('x')).status).toBe('BYPASS');
    expect((await broken.getList({})).status).toBe('BYPASS');
    expect(await broken.setDetail('x', agent)).toBe(false);
    await expect(broken.invalidateAfterCreate()).resolves.toBeUndefined();
    await expect(broken.invalidateAfterUpdate('x')).resolves.toBeUndefined();
    await expect(broken.invalidateAfterDelete('x')).resolves.toBeUndefined();
    expect(await broken.isHealthy()).toBe(false);
  });

  test('a corrupt cached value is treated as a bypass instead of crashing', async () => {
    await redis.set(cache.detailKey(agent.agentId), '{not json');
    expect((await cache.getDetail(agent.agentId)).status).toBe('BYPASS');
  });

  test('a disabled cache never touches Redis', async () => {
    const trap = () => {
      throw new Error('Redis must not be called when caching is disabled');
    };
    const off = new CacheService({ get: trap, set: trap, del: trap, incr: trap, ping: trap }, { enabled: false, logger: silent });

    expect((await off.getDetail('x')).status).toBe('BYPASS');
    expect((await off.getList({})).status).toBe('BYPASS');
    expect(await off.setDetail('x', agent)).toBe(false);
    await off.invalidateAfterCreate();
    expect(off.enabled).toBe(false);
    expect(await off.isHealthy()).toBe(false);
  });

  test('isHealthy is true when Redis answers PING', async () => {
    expect(await cache.isHealthy()).toBe(true);
  });
});
