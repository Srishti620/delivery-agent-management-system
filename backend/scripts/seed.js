/**
 * Loads sample delivery agents (all data is fictional).
 *   npm run seed          add any sample agents that are missing (matched by email)
 *   npm run seed:reset    delete ALL agents first, then load the samples
 */
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectMongo } = require('../src/config/db');
const { createRedisClient, waitForReady } = require('../src/config/redis');
const CacheService = require('../src/services/cacheService');
const Agent = require('../src/models/Agent');

const SAMPLE_AGENTS = [
  ['Aarav Sharma', '+919810000001', 'aarav.sharma@example.com', 'Kanpur - Civil Lines', 'active', 'motorbike'],
  ['Diya Verma', '+919810000002', 'diya.verma@example.com', 'Kanpur - Kakadeo', 'active', 'scooter'],
  ['Rohan Gupta', '+919810000003', 'rohan.gupta@example.com', 'Lucknow - Gomti Nagar', 'active', 'motorbike'],
  ['Ishita Singh', '+919810000004', 'ishita.singh@example.com', 'Lucknow - Hazratganj', 'on_leave', 'scooter'],
  ['Kabir Mehta', '+919810000005', 'kabir.mehta@example.com', 'Delhi - Dwarka', 'active', 'van'],
  ['Ananya Iyer', '+919810000006', 'ananya.iyer@example.com', 'Delhi - Saket', 'inactive', 'bicycle'],
  ['Vihaan Reddy', '+919810000007', 'vihaan.reddy@example.com', 'Noida - Sector 62', 'active', 'motorbike'],
  ['Meera Nair', '+919810000008', 'meera.nair@example.com', 'Noida - Sector 18', 'active', 'car'],
  ['Arjun Patel', '+919810000009', 'arjun.patel@example.com', 'Kanpur - Swaroop Nagar', 'inactive', 'motorbike'],
  ['Saanvi Joshi', '+919810000010', 'saanvi.joshi@example.com', 'Lucknow - Aliganj', 'active', 'bicycle'],
  ['Reyansh Khan', '+919810000011', 'reyansh.khan@example.com', 'Delhi - Rohini', 'active', 'scooter'],
  ['Navya Das', '+919810000012', 'navya.das@example.com', 'Noida - Sector 137', 'on_leave', 'none'],
].map(([fullName, phoneNumber, email, serviceArea, status, vehicleType]) => ({
  fullName,
  phoneNumber,
  email,
  serviceArea,
  status,
  vehicleType,
}));

(async () => {
  let redis;
  try {
    await connectMongo();

    if (process.argv.includes('--reset')) {
      const { deletedCount } = await Agent.deleteMany({});
      console.log(`Removed ${deletedCount} existing agent(s).`);
    }

    let created = 0;
    for (const sample of SAMPLE_AGENTS) {
      if (!(await Agent.exists({ email: sample.email }))) {
        await Agent.create(sample);
        created += 1;
      }
    }
    console.log(`Seeded ${created} agent(s); ${SAMPLE_AGENTS.length - created} already existed.`);

    // Writing straight to MongoDB bypasses the API, so invalidate cached lists ourselves (best effort).
    if (env.cache.enabled) {
      redis = createRedisClient();
      if (await waitForReady(redis)) {
        await new CacheService(redis, env.cache).invalidateAfterCreate();
        console.log('Cached agent lists invalidated.');
      }
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
})();
