const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf-8');

// Replace border: '3px_solid_navy' with effect: 'outline', border: '3px_solid_navy'
content = content.replace(/color: 'rgb:13888F', border: '3px_solid_navy'/g, "color: 'rgb:13888F', border: '3px_solid_navy', effect: 'outline'");

fs.writeFileSync('functions/index.js', content, 'utf-8');
console.log("Patched outline in index.js");
