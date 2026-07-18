import * as https from 'https';

function fetchUrl(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
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
    'https://psychosynth.vercel.app/api/v1/preview/personality-profile-library',
    'https://psychosynth.vercel.app/api/v1/preview/behavioral-response-library',
    'https://psychosynth.vercel.app/api/v1/preview/cognitive-bias-simulator'
  ];

  for (const url of endpoints) {
    console.log(`Fetching ${url}...`);
    const res = await fetchUrl(url);
    console.log(`Status: ${res.status}`);
    console.log(`Body (first 200 chars): ${res.body.slice(0, 200)}`);
    console.log('-------------------------------------------');
  }
}

main().catch(console.error);
