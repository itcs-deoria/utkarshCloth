// Express app setup: security middleware -> session -> routes
const path = require('path'), express = require('express'), session = require('express-session'), MongoStore = require('connect-mongo');
const helmet = require('helmet'), rateLimit = require('express-rate-limit');
const { locals, csrf, notFound, errorHandler } = require('./middleware');

const prod = process.env.NODE_ENV === 'production', app = express();
const shop = { // bill aur WhatsApp message me dikhta hai (.env se)
  name: process.env.SHOP_NAME || 'Meri Dukaan', address: process.env.SHOP_ADDRESS || '', phone: process.env.SHOP_PHONE || '',
  gstin: process.env.SHOP_GSTIN || '', upi: process.env.SHOP_UPI || '', note: process.env.BILL_NOTE || 'Dhanyavaad! Phir padhaariye.'
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('query parser', 'simple'); // ?a[$ne]=x jaise nested query band (NoSQL injection)

// Reverse proxy (Render/Nginx) ke peeche asli user ka IP aur HTTPS pehchanne ke liye.
// Render par RENDER env apne aap hota hai, isliye wahan khud 1 maan lete hain.
const proxy = process.env.TRUST_PROXY || (process.env.RENDER ? '1' : '');
if (proxy) app.set('trust proxy', +proxy);
else if (prod) console.warn('Dhyan do: production me TRUST_PROXY nahi hai. Proxy ke peeche ho to .env me TRUST_PROXY=1 daalo, warna login/cookie dikkat karega.');

// App install (PWA) ke liye: naam dukaan ke naam se aata hai. Login ke bina bhi chahiye, isliye session se pehle
app.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').set('Cache-Control', 'public, max-age=3600').send(JSON.stringify({
  name: shop.name, short_name: shop.name.slice(0, 12), description: 'Stock, orders aur bill', lang: 'hi', start_url: '/', scope: '/',
  display: 'standalone', background_color: '#f4f6fb', theme_color: '#2563eb',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
})));

app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { // security headers + CSP (inline JS band)
  'script-src': ["'self'"], 'style-src': ["'self'"], 'style-src-attr': ["'unsafe-inline'"], 'img-src': ["'self'", 'data:'],
  'form-action': ["'self'"], 'frame-ancestors': ["'none'"], 'upgrade-insecure-requests': prod ? [] : null } } }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: prod ? '1h' : 0 })); // static files limiter ke pehle: unki ginti nahi hoti
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false })); // har IP ki limit
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // logout ke baad back button se page na dikhe
app.use(express.urlencoded({ extended: false, limit: '20kb' })); // extended:false -> body me nested object/operator nahi

app.use(session({
  name: 'sid', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  // Cookie 15 min ki: bina login wale (bots) ke session jaldi saaf ho jaate hain. Login par 8 ghante ho jati hai (controllers/auth.js)
  cookie: { httpOnly: true, sameSite: 'lax', secure: prod, maxAge: 15 * 60 * 1000 } // production me HTTPS zaroori
}));
app.use(locals);
app.use(csrf);

// Views me kaam aane wale helpers
app.locals.fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '-');
app.locals.inputDate = d => (d ? new Date(d).toISOString().slice(0, 10) : ''); // <input type=date> ke liye
app.locals.num = v => +(+v || 0).toFixed(2); // 4.300000000000001 -> 4.3
const inrFmt = v => '\u20b9' + (+v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
app.locals.inr = inrFmt; // bill me paisa: ₹1,250
app.locals.shop = shop;
Object.assign(app.locals, require('./icons')); // icon(), ic(), sprite, favicon

app.use('/', require('./routes'));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
