// Ek hi box se sab dhundo: roll, product, order
const { Roll, Product, Order } = require('../models');
const { pick, searchRegex, todayStart } = require('../utils');

exports.show = async (req, res) => {
  const q = pick(req.query, ['q']).q || '';
  let rolls = [], products = [], orders = [];
  if (q) {
    const re = searchRegex(q), bill = /^(?:inv-?)?0*(\d{1,9})$/i.exec(q); // "INV-0007" ya "7" se bill number
    [rolls, products, orders] = await Promise.all([
      Roll.find({ $or: ['cloth', 'color', 'rollNo', 'supplier'].map(k => ({ [k]: re })) }).sort('-date').limit(20),
      Product.find({ $or: ['name', 'category', 'color'].map(k => ({ [k]: re })) }).sort('name').limit(20),
      Order.find({ $or: [{ client: re }, { phone: re }, { 'items.name': re }, ...(bill ? [{ billNo: +bill[1] }] : [])] }).sort('-created').limit(20)
    ]);
  }
  res.render('search', { q, rolls, products, orders, today: todayStart() });
};
