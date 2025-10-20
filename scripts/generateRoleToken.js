// Simple script to generate role tokens for the client link
// Usage: node scripts/generateRoleToken.js <role> <secret>
// Example: node scripts/generateRoleToken.js doctor my_super_secret

const crypto = require('crypto');

function makeRoleToken(role, secret) {
  const roleB64 = Buffer.from(role, 'utf8').toString('base64');
  const hash = crypto.createHash('sha256').update(role + secret).digest('hex');
  return `${roleB64}.${hash}`;
}

const [,, role, secret] = process.argv;

if (!role || !secret) {
  console.error('Usage: node scripts/generateRoleToken.js <role> <secret>');
  process.exit(1);
}

if (!['doctor','patient'].includes(role)) {
  console.error('Role must be "doctor" or "patient"');
  process.exit(1);
}

console.log(makeRoleToken(role, secret));
