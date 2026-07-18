import * as http from 'http';

function fetchUrl(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: data
        });
      });
    }).on('error', (err) => {
      resolve({
        status: 500,
        body: err.message
      });
    });
  });
}

async function main() {
  const endpoints = [
    'http://127.0.0.1:3000/api/health',
    'http://127.0.0.1:3000/api/v1/preview/personality-profile-library',
    'http://127.0.0.1:3000/api/v1/preview/behavioral-response-library',
    'http://127.0.0.1:3000/api/v1/preview/cognitive-bias-simulator'
  ];

  for (const url of endpoints) {
    console.log(`Fetching local: ${url}...`);
    const res = await fetchUrl(url);
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body.slice(0, 500)}`);
    console.log('-------------------------------------------');
  }
}

main().catch(console.error);
