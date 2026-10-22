// Entry point: env check -> DB connect -> server start
require('dotenv').config();
const mongoose = require('mongoose'), e = process.env;
['MONGO_URI', 'ADMIN_USER', 'ADMIN_PASS_HASH', 'SESSION_SECRET'].forEach(k => { if (!e[k]) { console.error('.env me ' + k + ' missing hai'); process.exit(1); } });
if (e.SESSION_SECRET.length < 32) { console.error('SESSION_SECRET kam se kam 32 character ka rakho'); process.exit(1); }
if (!e.ADMIN_PASS_HASH.startsWith('$2')) { console.error('ADMIN_PASS_HASH bcrypt hash hona chahiye: npm run hash -- "password"'); process.exit(1); }

const app = require('./app'), port = e.PORT || 3000;
mongoose.connect(e.MONGO_URI)
  .then(() => app.listen(port, () => console.log('Server chal raha hai: http://localhost:' + port)))
  .catch(err => { console.error('MongoDB connect nahi hua:', err.message); process.exit(1); });

// Koi promise ka error pakda na gaya to server band hone ke bajaye log ho jaye
process.on('unhandledRejection', err => console.error('Unhandled:', err));
