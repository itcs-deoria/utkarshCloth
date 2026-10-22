// Chhote helper functions jo kai jagah kaam aate hain
const mongoose = require('mongoose');

const first = v => String([].concat(v)[0]).trim();

// Sirf allowed fields lo (mass-assignment se bachav). Value ko string banata hai, trim + 200 char limit.
// keepEmpty=true -> khali value bhi rakho (edit form me kisi field ko khali karne ke liye)
exports.pick = (obj, keys, keepEmpty = false) => Object.fromEntries(
  keys.filter(k => obj[k] !== undefined && (keepEmpty || first(obj[k]) !== ''))
      .map(k => [k, first(obj[k]).slice(0, 200)])
);

// Search term ko normal text maano (special characters jaise ( ) * se regex na toote)
exports.searchRegex = term => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// WhatsApp link: 10 digit number par 91 (India) laga deta hai. Click karne par message pehle se likha khulta hai
exports.waLink = (phone, text) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
};

// "Aaj" India ke hisaab se, UTC midnight par (delivery date isi tarah save hoti hai)
exports.todayStart = () => new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

// 2 decimal tak round: 0.1 + 0.2 = 0.30000000000000004 jaisi galti se bachne ke liye
exports.round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Form me ek ya zyada value aa sakti hai -> hamesha array banao
exports.toArray = x => [].concat(x === undefined ? [] : x);

// User ki galti (galat input). Iska message seedha user ko dikhta hai
class FormError extends Error {}
exports.FormError = FormError;

// ID se record dhundo. Galat ya purani ID par null deta hai (crash nahi)
exports.findById = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id) : null);

// Record mila nahi (shayad pehle delete ho gaya) -> message dikhao aur list page par bhejo
exports.gone = (req, res, backTo, what) => { req.flash(what + ' nahi mila (shayad delete ho chuka hai)'); res.redirect(backTo); };
