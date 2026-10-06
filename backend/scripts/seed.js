// Usage: npm run seed   (resets sample data; keeps real users other than the demo user)
const { config, assertConfig } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedDatabase } = require('../src/seed/seed');

(async () => {
  try {
    assertConfig();
    await connectDB(config.mongoUri);
    await seedDatabase({ reset: true });
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
