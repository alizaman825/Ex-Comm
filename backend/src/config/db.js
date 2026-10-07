const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

let memoryServer;

// MONGO_URI=memory starts an embedded MongoDB (dev/demo fallback when Atlas is unreachable).
// Data persists in backend/.data/mongo between restarts.
async function resolveUri(uri) {
  if (uri !== 'memory' && uri !== 'memory:ephemeral') return uri;
  const { MongoMemoryServer } = require('mongodb-memory-server');
  if (uri === 'memory:ephemeral') {
    memoryServer = await MongoMemoryServer.create(); // nothing written to disk (used by end-to-end tests)
    return memoryServer.getUri('excomm');
  }
  const dbPath = path.resolve(__dirname, '../../.data/mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
  return memoryServer.getUri('excomm');
}

async function connectDB(uri) {
  const resolved = await resolveUri(uri);
  // Atlas strings often have no database name (they would land in "test"); default to "excomm".
  const hasDbName = /^mongodb(\+srv)?:[/][/][^/]+[/][^?]+/.test(resolved);
  const conn = await mongoose.connect(resolved, { serverSelectionTimeoutMS: 10000, ...(hasDbName ? {} : { dbName: process.env.DB_NAME || 'excomm' }) });
  const where = memoryServer ? 'embedded (MONGO_URI=memory)' : conn.connection.host;
  console.log(`MongoDB connected: ${where}/${conn.connection.name}`);
  return conn;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB };
