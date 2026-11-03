const mongoose = require('mongoose');
const { mongoUri } = require('./env');

// Connects to the local MongoDB. On failure we print a clear message and
// exit, because nothing in the API works without the database.
async function connectDB() {
  try {
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('Could not connect to MongoDB at', mongoUri);
    console.error('Is MongoDB running locally on port 27017? (Windows: check the "MongoDB" service; macOS/Linux: run `mongod`)');
    console.error('Reason:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
