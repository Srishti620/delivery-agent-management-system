module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // The first run may need to download a MongoDB binary for mongodb-memory-server.
  testTimeout: 120000,
};
