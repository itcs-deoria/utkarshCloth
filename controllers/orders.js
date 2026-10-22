const mongoose = require('mongoose');
const { Order, Product, Trash, nextBillNo } = require('../models');
const { billText, reminderText } = require('../messages');
const { pick, round2, toArray, FormError, findById, gone, todayStart, searchRegex, waLink } = require('../utils');
const MODES = ['Cash', 'UPI'];

exports.list = async (req, res) => {
  // Search ho to saare orders (chalu + delivered) me dhundo. Warna default: sirf chalu orders (Pending + Ready)
  const q = pick(req.query, ['q']).q || '';
  const view = q ? 'search' : ['Delivered', 'all'].includes(req.query.view) ? req.query.view : 'open';
  const filter = q ? { $or: [{ client: searchRegex(q) }, { phone: searchRegex(q) }] }
    : view === 'open' ? { status: { $ne: 'Delivered' } } : view === 'Delivered' ? { status: 'Delivered' } : {};
  const orders = await Order.find(filter).sort(view === 'open' ? 'deliveryDate' : '-deliveryDate').limit(200); // chalu: sabse purana pehle, baaki: sabse naya pehle
  res.render('orders', { orders, view, q, today: todayStart() });
};

const formData = async () => ({ products: await Product.find({ qty: { $gt: 0 } }).sort('name') });
exports.newForm = async (req, res) => res.render('order_new', { ...(await formData()), form: {} });

exports.create = async (req, res) => {
  const b = req.body, ids = toArray(b.product), qtys = toArray(b.qty), rates = toArray(b.rate);
  const takenStock = [], items = []; // takenStock = jo stock kam kiya, error aaye to wapas dena hai
  try {
    const head = pick(b, ['client', 'phone', 'address', 'deliveryDate']);
    if (!head.client || !head.phone || !head.deliveryDate) throw new FormError('Client naam, phone aur delivery date zaroori hain');

    for (let i = 0; i < ids.length; i++) {
      if (String(qtys[i] || '').trim() === '') continue; // qty khali = ye row khali hai
      const qty = +qtys[i];
      if (!Number.isInteger(qty) || qty < 1) throw new FormError('Qty poora number (1 ya zyada) hona chahiye');
      // Atomic: stock kaafi ho tabhi kam hoga (do log ek saath order banayein to bhi stock minus nahi jayega)
      const p = await findProductAndTake(ids[i], qty);
      if (!p) {
        const now = await findById(Product, ids[i]);
        throw new FormError(now ? 'Stock kam hai: ' + now.name + ' (bacha ' + now.qty + ')' : 'Product ab maujood nahi hai');
      }
      takenStock.push({ id: p._id, qty });
      const rateText = String(rates[i] || '').trim(), rate = rateText === '' ? p.price : round2(rateText);
      if (!(rate >= 0)) throw new FormError('Rate sahi likho');
      items.push({ product: p._id, name: (p.name + ' ' + (p.size || '')).trim(), qty, rate });
    }
    if (!items.length) throw new FormError('Kam se kam ek item daalo (qty bharo)');

    const order = new Order({ ...head, items }), advance = round2(b.advance || 0), total = round2(order.total);
    if (!(advance >= 0) || advance > total) throw new FormError('Advance sahi nahi hai (total Rs ' + total + ')');
    if (advance > 0) order.payments.push({ amount: advance, mode: MODES.includes(b.mode) ? b.mode : 'Cash' });
    order.billNo = await nextBillNo();
    await order.save();
    req.flash('Order ban gaya'); res.redirect('/orders/' + order._id);
  } catch (err) {
    // Koi bhi error aaye to kam kiya hua stock wapas
    for (const t of takenStock) await Product.updateOne({ _id: t.id }, { $inc: { qty: t.qty } });
    if (!(err instanceof FormError)) throw err;
    // Form dobara dikhao, bhara hua data ke saath (mobile par dobara type na karna pade)
    res.locals.flash = err.message;
    res.status(400).render('order_new', { ...(await formData()), form: b });
  }
};

// Stock kam karke product wapas deta hai; stock kam ho ya ID galat ho to null
function findProductAndTake(id, qty) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Product.findOneAndUpdate({ _id: id, qty: { $gte: qty } }, { $inc: { qty: -qty } });
}

// WhatsApp links: bill bhejo + (paisa baaki ho to) reminder
const whatsapp = (req, o) => {
  const { shop, fmtDate } = req.app.locals;
  return { bill: waLink(o.phone, billText(o, shop, fmtDate)), remind: o.due > 0 ? waLink(o.phone, reminderText(o, shop, fmtDate)) : null };
};

exports.take = findProductAndTake; // Trash se order wapas laate waqt bhi stock isi tarah kam hota hai

exports.show = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  res.render('order_show', { o, wa: whatsapp(req, o) });
};

exports.bill = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  res.render('bill', { o, wa: whatsapp(req, o) });
};

// ---- Items badlo: purane items ka stock wapas aur naye ka kam hota hai (sirf farak ka hisaab) ----
// Dropdown me wo products jo stock me hain + jo is order me pehle se hain (stock 0 ho tab bhi).
// avail = bacha hua stock + is order ka apna qty (itna tak badha sakte ho)
async function itemsData(o) {
  const inOrder = o.items.map(i => i.product).filter(Boolean);
  const products = await Product.find({ $or: [{ qty: { $gt: 0 } }, { _id: { $in: inOrder } }] }).sort('name');
  const known = new Set(products.map(p => String(p._id)));
  const mine = {}; // is order me har product ka qty
  o.items.forEach(i => { if (known.has(String(i.product))) mine[i.product] = (mine[i.product] || 0) + i.qty; });
  // Jo product rack se delete ho chuka hai uski item badal nahi sakte (stock ka hisaab nahi ban sakta), jyon ki tyon rehti hai
  const locked = o.items.filter(i => !known.has(String(i.product)));
  return { products, mine, locked, avail: Object.fromEntries(products.map(p => [p.id, p.qty + (mine[p.id] || 0)])) };
}

exports.itemsForm = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  const d = await itemsData(o), rows = o.items.filter(i => !d.locked.includes(i));
  const form = { product: rows.map(i => String(i.product)), qty: rows.map(i => i.qty), rate: rows.map(i => i.rate) };
  res.render('order_items', { o, ...d, form });
};

exports.saveItems = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  const b = req.body, ids = toArray(b.product), qtys = toArray(b.qty), rates = toArray(b.rate);
  const d = await itemsData(o), applied = []; // applied = stock me jo badlaav kiya, error aaye to ulta karna hai
  try {
    const rows = [];
    for (let i = 0; i < ids.length; i++) {
      if (String(qtys[i] || '').trim() === '') continue; // qty khali = ye row hata do
      const qty = +qtys[i], p = d.products.find(x => x.id === String(ids[i]));
      if (!Number.isInteger(qty) || qty < 1) throw new FormError('Qty poora number (1 ya zyada) hona chahiye');
      if (!p) throw new FormError('Product ab maujood nahi hai');
      const rateText = String(rates[i] || '').trim(), rate = rateText === '' ? p.price : round2(rateText);
      if (!(rate >= 0)) throw new FormError('Rate sahi likho');
      rows.push({ product: p._id, name: (p.name + ' ' + (p.size || '')).trim(), qty, rate });
    }
    if (!rows.length && !d.locked.length) throw new FormError('Kam se kam ek item rakho (qty bharo). Order hatana ho to Delete karo');

    // Naya total mil chuke paise se kam nahi hona chahiye
    const total = round2([...rows, ...d.locked].reduce((s, i) => s + i.qty * i.rate, 0));
    if (total < round2(o.paid)) throw new FormError('Naya total Rs ' + total + ' hai, par Rs ' + round2(o.paid) + ' pehle hi mil chuke hain');

    // Har product ka farak (naya qty - purana qty): badha to stock kam, ghata to stock wapas
    const delta = {};
    rows.forEach(r => { delta[r.product] = (delta[r.product] || 0) + r.qty; });
    Object.entries(d.mine).forEach(([id, q]) => { delta[id] = (delta[id] || 0) - q; });
    for (const [id, diff] of Object.entries(delta).sort((x, y) => y[1] - x[1])) { // pehle stock kam karne wale (fail ho sakte hain)
      if (diff === 0) continue;
      if (diff > 0) {
        if (!(await findProductAndTake(id, diff))) {
          const now = await findById(Product, id);
          throw new FormError('Stock kam hai: ' + (now ? now.name + ' (is order ke alawa bacha ' + now.qty + ')' : 'product nahi mila'));
        }
        applied.push({ id, inc: -diff });
      } else { await Product.updateOne({ _id: id }, { $inc: { qty: -diff } }); applied.push({ id, inc: -diff }); }
    }
    o.items = [...rows, ...d.locked.map(i => i.toObject())];
    await o.save();
    req.flash('Items update ho gaye, stock sahi kar diya'); res.redirect('/orders/' + o.id);
  } catch (err) {
    for (const a of applied) await Product.updateOne({ _id: a.id }, { $inc: { qty: -a.inc } }); // stock jaisa tha waisa
    if (!(err instanceof FormError)) throw err;
    res.locals.flash = err.message;
    res.status(400).render('order_items', { o, ...d, form: b });
  }
};

// Client ki details badlo (items badalne ke liye "Items badlo" button hai)
exports.edit = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  const d = pick(req.body, ['client', 'phone', 'deliveryDate']);
  if (!d.client || !d.phone || !d.deliveryDate) { req.flash('Client naam, phone aur delivery date khali nahi ho sakte'); return res.redirect('/orders/' + o.id); }
  Object.assign(o, d, pick(req.body, ['address'], true));
  await o.save();
  req.flash('Order update ho gaya'); res.redirect('/orders/' + o.id);
};

exports.pay = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  const amount = round2(req.body.amount);
  if (!(amount > 0) || amount > o.due) req.flash('Amount galat hai (baaki Rs ' + o.due + ')');
  else { o.payments.push({ amount, mode: MODES.includes(req.body.mode) ? req.body.mode : 'Cash' }); await o.save(); req.flash('Payment add ho gayi'); }
  res.redirect('/orders/' + o.id);
};

exports.status = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  if (!['Pending', 'Ready', 'Delivered'].includes(req.body.status)) return res.redirect('/orders/' + o.id);
  o.status = req.body.status; await o.save();
  // Delivered karte waqt paisa baaki ho to yaad dilao (rokte nahi, kyunki udhaar chalta hai)
  if (o.status === 'Delivered' && o.due > 0) req.flash('Delivered ho gaya, par Rs ' + o.due + ' baaki hai');
  res.redirect('/orders/' + o.id);
};

exports.remove = async (req, res) => {
  const o = await findById(Order, req.params.id);
  if (!o) return gone(req, res, '/orders', 'Order');
  const t = await Trash.create({ kind: 'order', label: o.client + ' (' + o.bill + ', Rs ' + round2(o.total) + ')', data: o.toObject() });
  // Delivered order ka maal customer ko ja chuka hai, uska stock wapas nahi jodna
  if (o.status !== 'Delivered') for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { qty: i.qty } });
  await o.deleteOne();
  req.flash(o.status === 'Delivered' ? 'Order delete hua (delivered tha, isliye stock wapas nahi joda)' : 'Order delete hua, stock wapas add ho gaya', t.id);
  res.redirect('/orders');
};
