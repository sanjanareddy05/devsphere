const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://devsphere:devsphere@localhost:5432/devsphere' });
  await client.connect();

  try {
    const users = [
      ['demo@example.com', 'demo123', 'Demo User'],
      ['alex@example.com', 'demo123', 'Alex'],
    ];

    for (const [email, password, name] of users) {
      await client.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', [email, '$2b$10$8K5r7q7EyV0P2HvyxqWjEur2LQ4MSA3Q7fTVH0MqXv2X0zmJKW5F2', name]);
    }

    console.log('Demo users seeded');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
