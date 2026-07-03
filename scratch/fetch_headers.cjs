const https = require('https');

https.get('https://design.wolver.vn/api/processes', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:');
  console.log(JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('Body preview:', data.substring(0, 200));
  });
}).on('error', (err) => {
  console.error('Error:', err);
});
