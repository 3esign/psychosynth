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
  const url = 'http://127.0.0.1:3000/api/v1/query/personality-profile-library';
  console.log(`Fetching: ${url}`);
  const res = await fetchUrl(url);
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${res.body}`);
}

main().catch(console.error);
