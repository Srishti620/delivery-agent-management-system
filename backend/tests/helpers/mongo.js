const mongoose = require('mongoose');

/**
 * The integration suite wipes the `agents` collection between tests, so it must never be pointed at a
 * real database by accident. A custom MONGODB_TEST_URI has to name a database containing "test".
 */
function assertSafeTestDatabase(uri) {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]*)/);
  const dbName = match ? match[1] : '';
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run tests against database "${dbName || '(default)'}". ` +
        'MONGODB_TEST_URI must name a database that contains "test" because the suite deletes all agents.'
    );
  }
}

/**
 * Connects mongoose for the integration tests.
 *  - MONGODB_TEST_URI set  -> use that server (e.g. mongodb://127.0.0.1:27017/delivery_agents_test, CI service container)
 *  - otherwise             -> start an in-memory MongoDB (downloads a mongod binary on first run, needs internet)
 */
async function startMongo() {
  const uri = process.env.MONGODB_TEST_URI;
  if (uri) {
    assertSafeTestDatabase(uri);
    await mongoose.connect(uri);
    return { stop: () => mongoose.disconnect() };
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  return {
    stop: async () => {
      await mongoose.disconnect();
      await server.stop();
    },
  };
}

module.exports = { startMongo };
