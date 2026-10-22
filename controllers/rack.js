const { Rack, Product, Trash } = require('../models');
const { pick, round2, findById, gone } = require('../utils');

const PRODUCT_FIELDS = ['name', 'category', 'gender', 'size', 'color', 'price', 'qty'];
const back = (req, res, msg, undoId) => { if (msg) req.flash(msg, undoId); res.redirect('/rack'); };

exports.list = async (req, res) => {
  const term = pick(req.query, ['q']).q || '';
  // Search me special characters (jaise ( ) *) ko normal text maano, warna regex toot jata hai
  const filter = term ? { name: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
  res.render('rack', { racks: await Rack.find(), products: await Product.find(filter).sort('name'), q: term });
};

exports.createRack = async (req, res) => {
  const d = pick(req.body, ['name']);
  if (!d.name) return back(req, res, 'Rack ka naam likho');
  await Rack.create(d); back(req, res);
};

// Form se aayi rack/shelf/column sirf tabhi rakho jab sach me exist karti ho (galat ID se galat location na bane)
async function cleanLocation(d) {
  const loc = {};
  const rack = d.rack ? await findById(Rack, d.rack) : null;
  if (!rack) return loc;
  loc.rack = rack._id;
  const shelf = d.shelf ? rack.shelves.id(d.shelf) : null;
  if (!shelf) return loc;
  loc.shelf = String(shelf._id);
  const col = d.column ? shelf.columns.id(d.column) : null;
  if (col) loc.column = String(col._id);
  return loc;
}

// Product ke basic fields check karo. Galti ho to message wapas deta hai
function checkProduct(d) {
  if (!d.name) return 'Product ka naam likho';
  if (d.price === undefined || !(+d.price >= 0)) return 'Price sahi likho';
  if (d.qty === undefined) d.qty = '0';
  if (!Number.isInteger(+d.qty) || +d.qty < 0) return 'Qty poora number (0 ya zyada) hona chahiye';
  d.price = round2(d.price);
  return null;
}

exports.createProduct = async (req, res) => {
  const d = pick(req.body, [...PRODUCT_FIELDS, 'rack', 'shelf', 'column']);
  const problem = checkProduct(d);
  if (problem) return back(req, res, problem);
  const loc = await cleanLocation(d);
  await Product.create({ ...pick(d, PRODUCT_FIELDS), ...loc });
  back(req, res, 'Product add ho gaya');
};

// Product ki details + location badlo (qty yaha nahi, uske liye +/- hai)
exports.editProduct = async (req, res) => {
  const product = await findById(Product, req.params.id);
  if (!product) return gone(req, res, '/rack', 'Product');
  const d = pick(req.body, ['name', 'category', 'gender', 'size', 'color', 'price', 'rack', 'shelf', 'column'], true);
  d.qty = String(product.qty); // qty jas ki tas rakho, bas baaki check chalane ke liye
  const problem = checkProduct(d);
  if (problem) return back(req, res, problem);
  const loc = await cleanLocation(d);
  const set = pick(d, ['name', 'category', 'gender', 'size', 'color', 'price'], true), unset = {};
  ['rack', 'shelf', 'column'].forEach(k => { if (loc[k]) set[k] = loc[k]; else unset[k] = 1; });
  await Product.updateOne({ _id: product._id }, { $set: set, $unset: unset }, { runValidators: true });
  back(req, res, 'Product update ho gaya');
};

exports.changeQty = async (req, res) => {
  const delta = +req.body.delta;
  if (!Number.isInteger(delta) || delta === 0) return back(req, res, 'Poora number likho (jaise 5 ya -2)');
  // Atomic: stock minus me na jaye, yeh check update ke saath hi hota hai
  const done = await Product.findOneAndUpdate({ _id: req.params.id, qty: { $gte: -delta } }, { $inc: { qty: delta } });
  back(req, res, done ? null : 'Stock minus nahi ho sakta (ya product nahi mila)');
};

exports.removeProduct = async (req, res) => {
  const p = await findById(Product, req.params.id);
  if (!p) return back(req, res, 'Product pehle hi delete ho chuka hai');
  const t = await Trash.create({ kind: 'product', label: (p.name + ' ' + (p.size || '')).trim() + ', stock ' + p.qty, data: p.toObject() });
  await p.deleteOne();
  back(req, res, 'Product delete ho gaya', t.id);
};

// op = add | rename | delete. Level: col diya -> column, shelf diya -> shelf, warna rack
exports.edit = async (req, res) => {
  const { op } = req.params, name = pick(req.body, ['name']).name;
  const rack = await findById(Rack, req.params.id);
  if (!rack) return gone(req, res, '/rack', 'Rack');
  if (!['add', 'rename', 'delete'].includes(op)) return back(req, res);

  const shelf = req.body.shelf ? rack.shelves.id(req.body.shelf) : null;
  const col = req.body.col && shelf ? shelf.columns.id(req.body.col) : null;
  if ((req.body.shelf && !shelf) || (req.body.col && !col)) return back(req, res, 'Jagah nahi mili (shayad pehle delete ho gayi)');
  const level = col ? 3 : shelf ? 2 : 1;

  if (op !== 'delete' && !name) return back(req, res, 'Naam likho');

  if (op === 'add') {
    if (level === 1) rack.shelves.push({ name }); else if (level === 2) shelf.columns.push({ name });
    else return back(req, res); // column ke andar kuch add nahi hota
  } else if (op === 'rename') {
    (col || shelf || rack).name = name;
  } else {
    // Delete se pehle us jagah ke products ki location hata do (taaki galat location na dikhe)
    if (level === 1) { await Product.updateMany({ rack: rack._id }, { $unset: { rack: 1, shelf: 1, column: 1 } }); await rack.deleteOne(); return back(req, res); }
    if (level === 2) { await Product.updateMany({ shelf: String(shelf._id) }, { $unset: { shelf: 1, column: 1 } }); shelf.deleteOne(); }
    else { await Product.updateMany({ column: String(col._id) }, { $unset: { column: 1 } }); col.deleteOne(); }
  }
  await rack.save(); back(req, res);
};
