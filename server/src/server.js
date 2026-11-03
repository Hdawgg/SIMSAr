const { port } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  await connectDB();
  app.listen(port, () => console.log(`SIMSAR API listening on http://localhost:${port}`));
}

start();
