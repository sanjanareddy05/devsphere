const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL must be defined.');
  process.exit(1);
}

const schemaPath = path.resolve(__dirname, '..', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function migrate() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(schemaSql);
    console.log('Database migration completed.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error('Database migration failed:', error.message || error);
  process.exit(1);
});
