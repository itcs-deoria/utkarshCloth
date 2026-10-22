// Saare middleware ek jagah: login check, flash message, CSRF, rate limit, errors
const crypto = require('crypto'), rateLimit = require('express-rate-limit');

// Login nahi hai to login page par bhejo
exports.requireLogin = (req, res, next) => (req.session.ok ? next() : res.redirect('/login'));

// async controller ke error ko error handler tak pahunchata hai
exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Views ke liye common values + ek baar dikhne wala flash message: req.flash('msg') -> agle page par dikhega
exports.locals = (req, res, next) => {
  res.locals.flash = req.session.flash;
  res.locals.undo = req.session.undo; // delete ke baad "Undo" button ke liye Trash record ki ID
  delete req.session.flash; delete req.session.undo;
  req.flash = (msg, undoId) => { req.session.flash = msg; req.session.undo = undoId ? String(undoId) : undefined; };
  res.locals.loggedIn = !!req.session.ok;
  res.locals.path = req.path; // navbar me current page highlight karne ke liye
  next();
};

// CSRF: har POST form me hidden _csrf token hona chahiye jo session ke token se match kare
exports.csrf = (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = Buffer.from(String((req.body && req.body._csrf) || '')), real = Buffer.from(req.session.csrf);
  if (sent.length === real.length && crypto.timingSafeEqual(sent, real)) return next();
  const err = new Error('Security token galat ya expire hai. Page refresh karke dobara try karo.');
  err.status = 403;
  next(err);
};

// Login brute-force: 15 min me sirf 5 galat try (sahi login count nahi hota)
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { msg: 'Bahut zyada galat login try hue. 15 minute baad dobara try karo.' })
});

exports.notFound = (req, res) => res.status(404).render('error', { msg: 'Page nahi mila' });

// Detail sirf server log me jaati hai, user ko saaf-suthra message
exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err.name + ': ' + err.message);
  let msg = 'Kuch gadbad ho gayi, dobara try karo';
  let status = err.status || 500;
  if (err.status === 403) msg = err.message;
  else if (err.name === 'CastError') { msg = 'Record nahi mila ya galat value hai'; status = 400; }
  else if (err.name === 'ValidationError') { msg = 'Form galat hai: ' + err.message; status = 400; }
  res.status(status).render('error', { msg });
};
