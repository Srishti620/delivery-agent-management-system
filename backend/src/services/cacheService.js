const crypto = require('crypto');

class CacheService {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.enabled = options.enabled !== false && Boolean(redis);
    this.prefix = options.prefix || 'dams';
    this.detailTtl = options.detailTtl ?? 300;
    this.listTtl = options.listTtl ?? 60;
    this.logger = options.logger || console;
  }

  detailKey(agentId) {
    return `${this.prefix}:agents:detail:${agentId}`;
  }

  versionKey() {
    return `${this.prefix}:agents:list:version`;
  }

  listKey(version, query) {
    const normalized = JSON.stringify(
      Object.keys(query)
        .filter((k) => query[k] !== undefined)
        .sort()
        .map((k) => [k, query[k]])
    );
    const hash = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16);
    return `${this.prefix}:agents:list:v${version}:${hash}`;
  }

  getDetail(agentId) {
    return this._get(this.detailKey(agentId));
  }

  setDetail(agentId, value) {
    return this._set(this.detailKey(agentId), value, this.detailTtl);
  }

  async getList(query) {
    const version = await this._listVersion();
    if (version === null) return { status: 'BYPASS' };
    const key = this.listKey(version, query);
    return { ...(await this._get(key)), key };
  }

  setList(key, value) {
    return this._set(key, value, this.listTtl);
  }

  async invalidateAfterCreate() {
    await this._bumpVersion();
  }

  async invalidateAfterUpdate(agentId) {
    await this._del(this.detailKey(agentId));
    await this._bumpVersion();
  }

  async invalidateAfterDelete(agentId) {
    await this._del(this.detailKey(agentId));
    await this._bumpVersion();
  }

  async isHealthy() {
    if (!this.enabled) return false;
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async _get(key) {
    if (!this.enabled) return { status: 'BYPASS' };
    try {
      const raw = await this.redis.get(key);
      if (raw === null || raw === undefined) return { status: 'MISS' };
      return { status: 'HIT', value: JSON.parse(raw) };
    } catch (err) {
      this._warn('get', err);
      return { status: 'BYPASS' };
    }
  }

  async _set(key, value, ttlSeconds) {
    if (!this.enabled) return false;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (err) {
      this._warn('set', err);
      return false;
    }
  }

  async _del(key) {
    if (!this.enabled) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this._warn('del', err);
    }
  }

  async _listVersion() {
    if (!this.enabled) return null;
    try {
      let version = await this.redis.get(this.versionKey());
      if (version === null || version === undefined) {
        await this.redis.set(this.versionKey(), String(Date.now()), 'NX');
        version = await this.redis.get(this.versionKey());
      }
      return version;
    } catch (err) {
      this._warn('version', err);
      return null;
    }
  }

  async _bumpVersion() {
    if ((await this._listVersion()) === null) return;
    try {
      await this.redis.incr(this.versionKey());
    } catch (err) {
      this._warn('incr', err);
    }
  }

  _warn(op, err) {
    this.logger.warn(`[cache] ${op} failed, continuing without cache: ${err.message}`);
  }
}

module.exports = CacheService;
