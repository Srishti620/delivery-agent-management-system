const mongoose = require('mongoose');
const env = require('./env');

async function connectMongo(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', env.nodeEnv !== 'production');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

module.exports = { connectMongo };
