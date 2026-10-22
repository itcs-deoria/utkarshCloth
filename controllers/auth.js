const bcrypt = require('bcryptjs'), crypto = require('crypto');
const LOGIN_AGE = 8 * 60 * 60 * 1000; // login ke baad session 8 ghante chalega

// Timing attack se bachne ke liye: dono ka hash bana ke constant-time compare
const same = (a, b) => crypto.timingSafeEqual(...[a, b].map(x => crypto.createHash('sha256').update(String(x)).digest()));

exports.page = (req, res) => (req.session.ok ? res.redirect('/') : res.render('login', { err: null }));

exports.login = async (req, res, next) => {
  const userOk = same(req.body.user || '', process.env.ADMIN_USER);
  // user galat ho tab bhi bcrypt chalta hai, taaki timing se pata na chale ki user sahi tha ya nahi
  const passOk = await bcrypt.compare(String(req.body.pass || ''), process.env.ADMIN_PASS_HASH);
  if (!(userOk && passOk)) {
    console.warn('Failed login, IP:', req.ip);
    return res.status(401).render('login', { err: 'Galat user ya password' });
  }
  // naya session id (session fixation se bachav)
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.ok = true;
    // Bina login wale session sirf 15 min jeete hain (app.js), login ke baad lamba session
    req.session.cookie.maxAge = LOGIN_AGE;
    res.redirect('/');
  });
};

exports.logout = (req, res) => req.session.destroy(() => { res.clearCookie('sid'); res.redirect('/login'); });
