const { Roll, Trash } = require('../models');
const { pick, round2, findById, gone, searchRegex } = require('../utils');

exports.list = async (req, res) => {
  const q = pick(req.query, ['q']).q || '', re = q && searchRegex(q); // cloth, color, roll no ya supplier se search
  const rolls = await Roll.find(q ? { $or: ['cloth', 'color', 'rollNo', 'supplier'].map(k => ({ [k]: re })) } : {}).sort('-date'), sum = {};
  // Cloth + color ke hisaab se total
  rolls.forEach(r => {
    const key = r.cloth + ' - ' + r.color;
    sum[key] = sum[key] || { total: 0, remaining: 0 };
    sum[key].total = round2(sum[key].total + r.total);
    sum[key].remaining = round2(sum[key].remaining + (r.remaining || 0));
  });
  res.render('godown', { rolls, sum, q });
};

exports.create = async (req, res) => {
  const d = pick(req.body, ['rollNo', 'cloth', 'color', 'supplier', 'rate', 'total']);
  const total = round2(d.total);
  if (!d.cloth || !d.color || !(total >= 0.1)) { req.flash('Cloth, color aur total meter (0.1 se zyada) zaroori hain'); return res.redirect('/godown'); }
  await Roll.create({ ...d, total, remaining: total });
  req.flash('Roll add ho gaya'); res.redirect('/godown');
};

// Roll ki details badlo (meter nahi badalte, wo sirf aana/bhejna se badalte hain)
exports.edit = async (req, res) => {
  const roll = await findById(Roll, req.params.id);
  if (!roll) return gone(req, res, '/godown', 'Roll');
  const d = pick(req.body, ['rollNo', 'cloth', 'color', 'supplier', 'rate'], true);
  if (!d.cloth || !d.color) { req.flash('Cloth aur color khali nahi ho sakte'); return res.redirect('/godown'); }
  Object.assign(roll, d); await roll.save();
  req.flash('Roll update ho gaya'); res.redirect('/godown');
};

// full=1 -> puraa roll office, nahi to diya hua meter
exports.move = async (req, res) => {
  const roll = await findById(Roll, req.params.id);
  if (!roll) return gone(req, res, '/godown', 'Roll');
  const left = roll.remaining || 0, full = req.body.full === '1';
  const meter = full ? left : round2(req.body.meter);
  if (!(meter > 0) || meter > left) { req.flash('Meter galat hai (godown me bacha: ' + left + 'm)'); return res.redirect('/godown'); }

  // Compare-and-swap: update tabhi hoga jab bacha hua meter wahi ho jo humne abhi padha tha.
  // Do log ek saath bhejein to doosre ka update fail ho jayega (meter dobara minus nahi hoga).
  const done = await Roll.findOneAndUpdate(
    { _id: roll._id, remaining: roll.remaining },
    { remaining: round2(left - meter), $push: { moves: { meter, full } } }
  );
  req.flash(done ? meter + 'm office bhej diya' : 'Isi beech roll badal gaya, dobara try karo');
  res.redirect('/godown');
};

exports.remove = async (req, res) => {
  const roll = await findById(Roll, req.params.id);
  if (!roll) return gone(req, res, '/godown', 'Roll');
  const t = await Trash.create({ kind: 'roll', label: roll.cloth + ' - ' + roll.color + (roll.rollNo ? ' (Roll ' + roll.rollNo + ')' : '') + ', ' + round2(roll.remaining || 0) + ' m', data: roll.toObject() });
  await roll.deleteOne();
  req.flash('Roll delete ho gaya', t.id); res.redirect('/godown');
};
