const { Roll, Product, Order } = require('../models');
const { round2, todayStart } = require('../utils');

exports.show = async (req, res) => {
  const start = todayStart(), end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [lowRolls, lowProducts, today, late, pending] = await Promise.all([
    Roll.find({ remaining: { $gt: 0, $lt: 5 } }).sort('remaining'), // khatam ho chuke roll ginti me nahi
    Product.find({ qty: { $lt: 3 } }).sort('qty'),
    Order.find({ deliveryDate: { $gte: start, $lt: end }, status: { $ne: 'Delivered' } }),
    // Late: delivery date nikal gayi par order abhi Delivered nahi hua
    Order.find({ deliveryDate: { $lt: start }, status: { $ne: 'Delivered' } }).sort('deliveryDate'),
    // Baaki paisa database khud nikaalta hai (saare orders memory me load nahi karne padte)
    Order.aggregate([
      { $project: { client: 1, phone: 1, due: { $subtract: [
        { $sum: { $map: { input: '$items', in: { $multiply: ['$$this.qty', '$$this.rate'] } } } },
        { $sum: '$payments.amount' }
      ] } } },
      { $match: { due: { $gt: 0.005 } } },
      { $sort: { due: -1 } }
    ])
  ]);
  const dueTotal = round2(pending.reduce((s, o) => s + o.due, 0));
  res.render('dashboard', { lowRolls, lowProducts, today, late, pending, dueTotal });
};
