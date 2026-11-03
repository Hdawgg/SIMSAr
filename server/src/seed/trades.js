// The starting list of trades and their fair minimum hourly rates (₹). This is
// seed data only: once it is in MongoDB the admin manages trades from the
// dashboard, and the app reads them from the `trades` collection.
const Trade = require('../models/Trade');

const DEFAULT_TRADES = [
  { slug: 'electrician', label: 'Electrician', plural: 'Electricians', icon: 'bi-lightning-charge-fill', minHourlyRate: 350, description: 'Wiring, fittings, MCB and inverter work.' },
  { slug: 'plumber', label: 'Plumber', plural: 'Plumbers', icon: 'bi-droplet-fill', minHourlyRate: 320, description: 'Leaks, taps, bathroom fittings and tanks.' },
  { slug: 'carpenter', label: 'Carpenter', plural: 'Carpenters', icon: 'bi-hammer', minHourlyRate: 380, description: 'Furniture, doors, shelves and repairs.' },
  { slug: 'painter', label: 'Painter', plural: 'Painters', icon: 'bi-brush-fill', minHourlyRate: 280, description: 'Interior and exterior painting.' },
  { slug: 'tailor', label: 'Tailor', plural: 'Tailors', icon: 'bi-scissors', minHourlyRate: 250, description: 'Stitching, alterations and bulk orders.' },
  { slug: 'ac', label: 'AC Technician', plural: 'AC Technicians', icon: 'bi-fan', minHourlyRate: 420, description: 'Installation, servicing and gas top-ups.' },
  { slug: 'mason', label: 'Mason', plural: 'Masons', icon: 'bi-bricks', minHourlyRate: 300, description: 'Brickwork, plastering and tiling.' },
].map((t, i) => ({ ...t, sortOrder: (i + 1) * 10 }));

// Upserts by slug. With overwrite=false (npm run seed:trades) only missing
// trades are added, so rates an admin has changed are left alone.
async function upsertTrades({ overwrite = true } = {}) {
  const ops = DEFAULT_TRADES.map(({ slug, ...fields }) => ({
    updateOne: {
      filter: { slug },
      update: overwrite ? { $set: { ...fields, active: true }, $setOnInsert: { slug } } : { $setOnInsert: { slug, ...fields, active: true } },
      upsert: true,
    },
  }));
  const result = await Trade.bulkWrite(ops);
  return { inserted: result.upsertedCount, updated: result.modifiedCount };
}

module.exports = { DEFAULT_TRADES, upsertTrades };
