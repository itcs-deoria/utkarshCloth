# Stock Manager (Node.js + Express + MongoDB + EJS)

Kapde ki shop ke liye: Godown (cloth rolls), Counter Rack (readymade products), Client Orders + payments + bill.
Phone par bhi poora chalta hai (neeche navbar, bade buttons, cards). Buttons me icon ke saath naam bhi dikhta hai (`.lbl`), chhupana ho to style.css me `.lbl` ko `display:none` kar do.

## Chalane ke steps
1. `npm install`
2. `.env.example` ko `.env` naam se copy karo, MongoDB Atlas URI, admin user daalo
3. `npm run hash -- "apna-password"` chalao, jo hash mile wo `.env` me `ADMIN_PASS_HASH` me paste karo
4. `SESSION_SECRET` bharo (32+ random characters, command `.env.example` me likhi hai)
5. `npm start` (ya `npm run dev`) -> http://localhost:3000

## Dukaan ki details (bill par)
`.env` me `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_PHONE`, `SHOP_GSTIN`, `SHOP_UPI`, `BILL_NOTE` bharo (sab optional). Ye bill aur WhatsApp message me aate hain.

## Orders me kya-kya hai
- **WhatsApp**: order page par "WhatsApp Bill" (pura bill) aur "Payment Reminder" (jab paisa baaki ho). Button dabate hi message pehle se likha WhatsApp me khulta hai (10 digit number par 91 apne aap lagta hai)
- **Search**: Orders me client naam / phone se (chalu + delivered dono me), Godown me cloth / color / roll no / supplier se
- **Items badlo**: order page par "Items badlo". Qty badlo, item hatao ya jodo, stock apne aap sahi hota hai. Naya total mil chuke paise se kam nahi ho sakta
- **Bill**: dukaan ka naam, bill number (INV-0001...), item table, total/paid/baaki, paisa poora ho to PAID stamp, print ke liye A4 ready

## Trash, Search, App install
- **Undo / Trash**: roll, product ya order delete karte hi upar "Undo" button aata hai. Baad me Home -> Trash se 30 din tak wapas la sakte ho. Order wapas laane par stock phir kam hota hai (kam ho to order nahi aata)
- **Search** (Home ke upar): ek box se client, phone, cloth, color, product aur bill number (INV-0007 ya 7) dhundo
- **App install**: HTTPS par kholo. Android/Chrome me Home par "Install karo" button aata hai, iPhone me Safari ka Share -> Add to Home Screen. App sirf internet ke saath chalta hai (private data cache nahi hota)

## Files (kam se kam rakhi hain)
- `server.js` start + DB connect | `app.js` express setup + security
- `routes.js` saare URL | `models.js` saare database schema
- `icons.js` saare icons (SVG). Naya icon: yaha ek line jodo, views me `<%- icon('naam') %>`
- `middleware.js` login check, flash, CSRF, rate limit, errors | `utils.js` chhote helpers | `messages.js` WhatsApp ke message
- `controllers/` saari logic (auth, dashboard, godown, rack, orders)
- `views/` EJS pages (`views/partials/` me header/footer) | `public/style.css` design | `public/js/app.js` saara JS

## Naya feature jodne ka tareeka
`models.js` me field -> `controllers/` me logic -> `routes.js` me URL -> `views/` me form/page.

## Security
- Login: bcrypt hash, constant-time compare, login par naya session id, 15 min me 5 galat try ke baad block
- CSRF token har POST form me | helmet + CSP (inline JS band, saara JS `public/js/app.js` me)
- Session: httpOnly + sameSite cookie, login ke baad 8 ghante, MongoDB me store. Bina login wale session sirf 15 min
- NoSQL injection band, sirf allowed fields save (`utils.js` ka `pick`), EJS auto-escape, body size limit
- User ko saaf message, error detail sirf server log me

## Deploy checklist
1. HTTPS lagao aur `NODE_ENV=production` rakho. Proxy (Nginx) ke peeche ho to `TRUST_PROXY=1` (Render par apne aap)
2. MongoDB Atlas: sirf server ka IP allow karo, DB user ko sirf is database ka readWrite do
3. `.env` kabhi git/zip me share mat karo; kabhi-kabhi `npm audit` chalao
