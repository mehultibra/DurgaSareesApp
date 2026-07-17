const https = require('https');
const url = 'https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o?prefix=Digital%20Linen%20White%2F&delimiter=%2F';
https.get(url, function(res) {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
