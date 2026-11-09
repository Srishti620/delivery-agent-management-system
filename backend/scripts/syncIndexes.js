const mongoose = require('mongoose');
const { connectMongo } = require('../src/config/db');
const Agent = require('../src/models/Agent');

(async () => {
  try {
    await connectMongo();
    const dropped = await Agent.syncIndexes(); // creates missing indexes, drops ones no longer in the schema
    const indexes = await Agent.collection.indexes();
    console.log('Dropped stale indexes:', dropped.length ? dropped.join(', ') : 'none');
    console.log('Current indexes:');
    indexes.forEach((i) => console.log(` - ${i.name}${i.unique ? ' (unique)' : ''}`));
  } catch (err) {
    console.error('Index sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
