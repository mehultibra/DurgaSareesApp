const fs = require('fs');
const https = require('https');

const url = 'https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o/Digital%20Linen%20White%2Fcover.webp?alt=media';
const file = fs.createWriteStream('test_image.webp');

https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close();
    console.log('Download completed.');
  });
}).on('error', function(err) {
  fs.unlink('test_image.webp');
  console.error('Error downloading:', err.message);
});
