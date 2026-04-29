const fs = require('fs');

const apiBase = process.env.INSIGHTA_API_BASE || 'https://stage1be-production.up.railway.app';

const content = `// Auto-generated at build time. Do not edit.
window.INSIGHTA_API_BASE = "${apiBase}";
`;

fs.writeFileSync('./js/env.js', content);
console.log('env.js generated with API_BASE:', apiBase);