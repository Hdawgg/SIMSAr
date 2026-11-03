// npm run seed:trades — adds any missing default trades to an existing
// `simsar` database WITHOUT dropping anything or overwriting admin changes.
// Use it after pulling this version if you don't want to re-run the full seed.
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Trade = require('../models/Trade');
const { upsertTrades } = require('./trades');

async function run() {
  await connectDB();
  await Trade.syncIndexes();
  const { inserted } = await upsertTrades({ overwrite: false });
  console.log(`Trades: ${inserted} added, ${await Trade.countDocuments()} in total.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seeding trades failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
