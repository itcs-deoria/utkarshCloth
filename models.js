// Saare database models ek file me
const { Schema, model } = require('mongoose');

// Bill number ginne wala counter (1, 2, 3...)
const Counter = model('Counter', new Schema({ _id: String, n: { type: Number, default: 0 } }));
const nextBillNo = async () => (await Counter.findOneAndUpdate({ _id: 'bill' }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' })).n;

// Phase 1: Godown roll. total = kitna aaya, remaining = godown me bacha, moves = office gaye meter ki history
const Roll = model('Roll', new Schema({
  rollNo: { type: String, trim: true },
  cloth: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  supplier: { type: String, trim: true },
  rate: { type: Number, min: 0 },
  total: { type: Number, required: true, min: 0.1 },
  remaining: { type: Number, min: 0 },
  date: { type: Date, default: Date.now },
  moves: [{ meter: Number, full: Boolean, date: { type: Date, default: Date.now } }]
}, { timestamps: true }));

// Phase 2: Rack -> Shelves -> Columns (naam aap khud set karte ho)
const Rack = model('Rack', new Schema({
  name: { type: String, required: true, trim: true },
  shelves: [{ name: { type: String, required: true, trim: true }, columns: [{ name: { type: String, required: true, trim: true } }] }]
}));

// Phase 2: Readymade product jo rack ke kisi column me rakha hai
const Product = model('Product', new Schema({
  name: { type: String, required: true, trim: true }, category: String, gender: String, size: String, color: String,
  price: { type: Number, required: true, min: 0 },
  qty: { type: Number, default: 0, min: 0 },
  rack: { type: Schema.Types.ObjectId, ref: 'Rack' }, shelf: String, column: String
}, { timestamps: true }));

// Phase 3: Client order + payments. total/paid/due virtual hain (save nahi hote, calculate hote hain)
const orderSchema = new Schema({
  client: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: String,
  deliveryDate: Date,
  status: { type: String, enum: ['Pending', 'Ready', 'Delivered'], default: 'Pending' },
  items: [{ product: Schema.Types.ObjectId, name: String, qty: { type: Number, min: 1 }, rate: { type: Number, min: 0 } }],
  payments: [{ amount: { type: Number, min: 0.01 }, mode: { type: String, enum: ['Cash', 'UPI'], default: 'Cash' }, date: { type: Date, default: Date.now } }],
  billNo: Number, // purane orders me nahi hai, unke liye virtual 'bill' ID se bana leta hai
  created: { type: Date, default: Date.now }
});
orderSchema.index({ status: 1, deliveryDate: 1 }); // orders list/dashboard tez rakhne ke liye
orderSchema.virtual('bill').get(function () { return 'INV-' + (this.billNo ? String(this.billNo).padStart(4, '0') : String(this._id).slice(-6).toUpperCase()); });
orderSchema.virtual('total').get(function () { return this.items.reduce((sum, i) => sum + i.qty * i.rate, 0); });
orderSchema.virtual('paid').get(function () { return this.payments.reduce((sum, p) => sum + p.amount, 0); });
orderSchema.virtual('due').get(function () { return Math.round((this.total - this.paid) * 100) / 100; });
const Order = model('Order', orderSchema);

// Delete kiya hua record 30 din tak yaha rehta hai (phir MongoDB apne aap hata deta hai). data = poora purana record
const Trash = model('Trash', new Schema({
  kind: { type: String, enum: ['roll', 'product', 'order'], required: true },
  label: String,
  data: Schema.Types.Mixed,
  deletedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }
}));

module.exports = { Roll, Rack, Product, Order, Trash, nextBillNo };
