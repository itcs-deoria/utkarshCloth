// Use: npm run hash -- "apna-password"  -> bcrypt hash print karta hai (.env me ADMIN_PASS_HASH me daalo)
const p = process.argv[2];
if (!p || p.length < 8) { console.error('Password kam se kam 8 character ka do: npm run hash -- "password"'); process.exit(1); }
console.log(require('bcryptjs').hashSync(p, 12));
