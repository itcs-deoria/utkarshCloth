// Trash: delete kiya hua roll / product / order 30 din tak wapas laa sakte ho
const { Roll, Product, Order, Trash } = require('../models');
const { FormError, findById, gone } = require('../utils');
const { take } = require('./orders');

const MODELS = { roll: Roll, product: Product, order: Order };
const BACK = { roll: '/godown', product: '/rack', order: '/orders' };

exports.list = async (req, res) => res.render('trash', { items: await Trash.find().sort('-deletedAt').limit(100) });

exports.restore = async (req, res) => {
  const t = await findById(Trash, req.params.id);
  if (!t) return gone(req, res, '/trash', 'Ye item');
  const Model = MODELS[t.kind], d = t.data, taken = []; // taken = order wapas laate waqt jo stock kam kiya
  try {
    if (await Model.exists({ _id: d._id })) { await t.deleteOne(); req.flash('Ye pehle se maujood hai'); return res.redirect(BACK[t.kind]); }
    // Order delete hone par stock wapas gaya tha, isliye wapas laane par stock phir kam hoga (kaafi na ho to order nahi aayega)
    if (t.kind === 'order' && d.status !== 'Delivered') {
      for (const i of d.items) {
        if (!i.product || !(await Product.exists({ _id: i.product }))) continue; // product ab nahi hai
        if (!(await take(i.product, i.qty))) throw new FormError('Stock kam hai: ' + i.name + '. Order wapas nahi aa sakta');
        taken.push(i);
      }
    }
    await new Model(d).save();
    await t.deleteOne();
    req.flash(t.label + ' wapas aa gaya');
    res.redirect(t.kind === 'order' ? '/orders/' + d._id : BACK[t.kind]);
  } catch (err) {
    for (const i of taken) await Product.updateOne({ _id: i.product }, { $inc: { qty: i.qty } });
    if (!(err instanceof FormError)) throw err;
    req.flash(err.message); res.redirect('/trash');
  }
};

// Hamesha ke liye hatao
exports.purge = async (req, res) => {
  const t = await findById(Trash, req.params.id);
  if (t) await t.deleteOne();
  req.flash('Hamesha ke liye hata diya'); res.redirect('/trash');
};
