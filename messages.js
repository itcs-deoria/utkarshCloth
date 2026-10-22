// WhatsApp ke message (client ko bhejne ke liye). Naam, items aur paisa pehle se likha aata hai
const { round2 } = require('./utils');
const rs = n => 'Rs ' + round2(n).toLocaleString('en-IN');

// Pura bill
exports.billText = (o, shop, fmtDate) => [
  '*' + shop.name + '*',
  'Bill ' + o.bill + ' | ' + fmtDate(o.created),
  '',
  'Namaste ' + o.client + ',',
  'Aapka order:',
  ...o.items.map((i, k) => (k + 1) + '. ' + i.name + ' x ' + i.qty + ' = ' + rs(i.qty * i.rate)),
  '',
  'Total: ' + rs(o.total),
  'Mila: ' + rs(o.paid),
  o.due > 0 ? '*Baaki: ' + rs(o.due) + '*' : 'Poora payment mil gaya.',
  'Delivery: ' + fmtDate(o.deliveryDate),
  o.due > 0 && shop.upi ? 'UPI: ' + shop.upi : '',
  '',
  shop.note + (shop.phone ? ' (' + shop.phone + ')' : '')
].join('\n');

// Baaki paisa ka yaad dilana
exports.reminderText = (o, shop, fmtDate) => [
  'Namaste ' + o.client + ',',
  shop.name + ' ki taraf se yaad dila rahe hain: aapke order (' + o.bill + ', ' + fmtDate(o.created) + ') ka *' + rs(o.due) + '* abhi baaki hai.',
  'Kripya jaldi payment kar dein.',
  shop.upi ? 'UPI: ' + shop.upi : '',
  'Dhanyavaad.'
].filter((l, k, a) => l !== '' || a[k - 1] !== '').join('\n');
