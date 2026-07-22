const http = require('http');

async function makeRequest(index, total) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/health', method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve({ index, status: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const total = 20;
  const results = [];
  for (let i = 0; i < total; i += 1) {
    results.push(await makeRequest(i + 1, total));
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
