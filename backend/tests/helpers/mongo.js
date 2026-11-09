const mongoose = require('mongoose');

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
