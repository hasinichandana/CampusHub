
const mongoose = require('mongoose');

const getDatabaseNameFromUri = (uri) => {
  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('MONGO_URI is not a valid MongoDB connection URI');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGO_URI must use mongodb:// or mongodb+srv://');
  }

  const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, '').split('/')[0] || '');
  if (!databaseName) {
    throw new Error('MONGO_URI must specify a database name');
  }

  return databaseName;
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) {
    throw new Error('MONGO_URI is missing; configure it in backend/.env or the process environment');
  }

  const expectedDatabaseName = getDatabaseNameFromUri(uri);

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }

  const connection = mongoose.connection;
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error('MongoDB connection did not become ready');
  }

  if (connection.name !== expectedDatabaseName) {
    throw new Error('Connected MongoDB database does not match the database specified in MONGO_URI');
  }

  console.log(`MongoDB Connected: ${connection.host}`);
  console.log(`Database Name: ${connection.name}`);

  const collections = await connection.db.listCollections().toArray();
  const collectionCounts = await Promise.all(
    collections.map(async (collection) => {
      const count = await connection.db.collection(collection.name).countDocuments();
      return [collection.name, count];
    })
  );

  console.log('\n--- MongoDB Collection Counts ---');
  for (const [collectionName, count] of collectionCounts) {
    console.log(`${collectionName}: ${count}`);
  }
  console.log('--- End of Counts ---\n');

  return connection;
};

module.exports = connectDB;
