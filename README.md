# DukanAI — आपकी दुकान का डिजिटल मुंशी

Voice + WhatsApp inventory management for Indian kirana shops.

---

## Project Structure

```
dukanai/
├── backend/
│   ├── models/
│   │   ├── Item.js          ← Product schema
│   │   ├── SaleLog.js       ← Every stock change log
│   │   ├── Customer.js      ← Udhaar (credit) customers
│   │   └── CreditLog.js     ← Udhaar/payment entries
│   ├── routes/
│   │   ├── items.js         ← Full CRUD + stock update API
│   │   ├── voice.js         ← Marathi NLP parser (Gemini AI)
│   │   ├── bill.js          ← Bill photo scan (Gemini Vision)
│   │   ├── alerts.js        ← WhatsApp alert triggers
│   │   ├── credit.js        ← Udhaar ledger by voice
│   │   ├── forecast.js      ← Consumption velocity + reorder
│   │   └── webhook.js       ← WhatsApp bot (voice notes + confirmations)
│   ├── services/
│   │   └── whatsapp.js      ← Twilio WhatsApp integration
│   ├── utils/
│   │   └── nlp.js           ← Shared Marathi NLP helpers
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       ← Marathi sidebar navigation
│   │   │   └── VoiceAddItem.jsx ← Voice add-item dialog
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    ← Stats + recent activity
│   │   │   ├── VoiceInput.jsx   ← Mic button + Marathi NLP
│   │   │   ├── Inventory.jsx    ← Full CRUD
│   │   │   ├── BillScan.jsx     ← Photo upload + AI read
│   │   │   ├── Udhaar.jsx       ← Credit ledger by voice
│   │   │   ├── Forecast.jsx     ← Stock-out prediction + ordering
│   │   │   ├── WhatsAppBot.jsx  ← Bot simulator + setup
│   │   │   └── Alerts.jsx       ← WhatsApp alerts panel
│   │   ├── hooks/
│   │   │   └── useVoice.js      ← Web Speech API hook
│   │   ├── utils/
│   │   │   └── api.js           ← All axios API calls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## Tech Stack

| Part | Technology |
|------|-----------|
| Frontend | React 18 + Vite |
| Voice | Web Speech API (built into Chrome) |
| NLP | Google Gemini Flash |
| Bill Scan | Google Gemini Vision |
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| WhatsApp | Twilio WhatsApp API |
| Language | Marathi (Devanagari) UI |

---

## Setup — Step by Step

### Step 1 — Get API Keys (free)

1. **MongoDB Atlas** — https://cloud.mongodb.com → Free cluster → Get connection string
2. **Gemini API** — https://makersuite.google.com/app/apikey → Create API key (free)
3. **Twilio WhatsApp** — https://twilio.com → Free trial → WhatsApp Sandbox
   - Send "join <your-code>" to +1 415 523 8886 on WhatsApp to activate sandbox

### Step 2 — Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in all values in .env
npm run dev
# Server starts at http://localhost:5000
```

### Step 3 — Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App opens at http://localhost:5173
```

---

## How to Use (Demo Flow)

### 1. Add some items first
Go to **सामान की लिस्ट** → Add items like:
- Atta (आटा) — 50 kg — ₹40/₹50
- Maggi — 100 pcs — ₹12/₹14
- Toor Dal — 20 kg — ₹100/₹120

### 2. Show voice feature
Go to **आवाज़ से बदलें** → Click mic → Say:
- *"दस किलो आटा आया"* → App understands: restock 10 kg Atta
- *"पाँच मैगी बिकी"* → App understands: sold 5 Maggi

### 3. Show bill scan
Go to **बिल स्कैन** → Upload a supplier bill photo → AI reads all items → One tap adds to stock

### 4. Show WhatsApp alert
Go to **अलर्ट** → Click "Summary भेजें" → WhatsApp message appears on phone

### 5. Udhaar by voice (उधार खाते)
Go to **उधार खाते** → Click mic → Say:
- *"शर्मा काकांनी 500 चा माल घेतला"* → Udhaar ₹500 recorded against Sharma
- *"शर्मा काकांनी 200 पैसे दिले"* → Payment ₹200 recorded, balance drops
- Check the balance, tap 📱 to send a WhatsApp payment reminder

### 6. Predictive reorder (ऑर्डर अंदाज)
Go to **ऑर्डर अंदाज** → The app computes each item's sales velocity from the last 14 days
of SaleLogs and shows how many days of stock remain → Tick items → "ऑर्डर ड्राफ्ट" →
Edit the order → Send to the supplier on WhatsApp (`SUPPLIER_WHATSAPP`)

### 7. WhatsApp bot — no app needed (WhatsApp बॉट)
Send a message **or a voice note** to the shop's Twilio WhatsApp number:
- *"दहा किलो गहू आला"* → stock updated
- *"शर्मा काकांनी 500 चा माल घेतला"* → bot asks "नोंदवायचा? (हो / नाही)" — money always confirms
- *"ऑर्डर कर"* → bot drafts the supplier order from the forecast and sends it on confirmation
- *"आजचा हिशोब सांग"* → today's summary right in the chat

Point the Twilio sandbox webhook at `POST https://<backend>/api/webhook`.
To try the bot logic without Twilio, use the **simulator** on the WhatsApp बॉट page.

---

## API Endpoints

```
GET    /api/items              → All items
GET    /api/items/stats        → Dashboard stats
GET    /api/items/logs/recent  → Recent activity
POST   /api/items              → Add item
PUT    /api/items/:id          → Edit item
PATCH  /api/items/:id/stock    → Update quantity
DELETE /api/items/:id          → Remove item

POST   /api/voice/parse        → Parse Marathi voice text
POST   /api/bill/scan          → Scan bill image

GET    /api/alerts             → Low/out stock list
POST   /api/alerts/daily-summary → Send WhatsApp summary
POST   /api/alerts/send        → Send custom WhatsApp message

GET    /api/credit             → Customers + udhaar balances
POST   /api/credit/customers   → Add customer
POST   /api/credit/parse       → Parse udhaar/payment sentence (voice)
POST   /api/credit/entry       → Record udhaar or payment
GET    /api/credit/logs/:id    → Customer credit history
POST   /api/credit/remind/:id  → WhatsApp payment reminder
POST   /api/credit/settle/:id  → Record full payment

GET    /api/forecast           → Stock-out forecast per item
POST   /api/forecast/draft     → Draft supplier order message
POST   /api/forecast/send      → Send order to supplier on WhatsApp

POST   /api/webhook            → Twilio WhatsApp bot webhook
GET    /api/webhook            → Bot status
POST   /api/webhook/simulate   → Test bot without Twilio
```

---

## 🚀 Deployment on Vercel

### Prerequisites
- GitHub account (repo already pushed)
- Vercel account (free) — https://vercel.com
- MongoDB Atlas account (free cluster)
- API keys: Gemini, Twilio

### One-Click Deployment

1. **Go to Vercel** → https://vercel.com/new
2. **Connect GitHub** → Select `rushi380/DukanAI` repository
3. **Configure Environment Variables** in Vercel dashboard:
   - `MONGO_URI` — MongoDB Atlas connection string
   - `GEMINI_API_KEY` — Gemini API key
   - `TWILIO_ACCOUNT_SID` — From Twilio console
   - `TWILIO_AUTH_TOKEN` — From Twilio console
   - `TWILIO_WHATSAPP_FROM` — Twilio WhatsApp sandbox number (whatsapp:+1415...)
   - `OWNER_WHATSAPP` — Your WhatsApp number (whatsapp:+91XXXXXXXXXX)
   - `SUPPLIER_WHATSAPP` — (optional) supplier's number for bot orders

4. **Deploy** → Vercel automatically:
   - Builds frontend (React + Vite)
   - Deploys backend as serverless functions
   - Routes `/api/*` to backend, static files to frontend

5. **Connect the WhatsApp bot** (optional):
   - Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Set the sandbox **When a message comes in** webhook to:
     `https://<your-deployment>.vercel.app/api/webhook` (POST)
   - Join the sandbox from your phone ("join <code>") and message it — text or voice notes

6. **Update Frontend API URL** (if not using root domain):
   - Create `.env.local` in `frontend/` directory
   - Add: `VITE_API_URL=https://your-vercel-deployment.vercel.app/api`

### Deployment Status
- Frontend: Automatic (every push to `main`)
- Backend: Automatic serverless function deployment
- Database: Connected via MongoDB Atlas

---

## 🛠️ Troubleshooting

**Issue: API calls return 404?**
- Verify backend environment variables are set in Vercel
- Check that `.env` file is NOT committed (should be in `.gitignore`)

**Issue: WhatsApp bot doesn't reply?**
- Check the Twilio sandbox webhook points to `https://<backend>/api/webhook` (POST)
- Voice-note transcription needs `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` (media download)
- Test the bot logic first in the app's **WhatsApp बॉट** page (simulator, no Twilio needed)

**Issue: Orders/alerts never arrive?**
- Without Twilio credentials the service runs in *simulation* mode — messages
  are logged to the server console instead of sent. Check `TWILIO_WHATSAPP_FROM`
  and `OWNER_WHATSAPP` are set (see `.env.example`).

**Issue: Multer file upload fails?**
- Vercel has limitations on temp file storage
- Use Cloudinary/Firebase Storage for production file uploads

---

## 📝 License
Open source for Indian kirana shops 🇮🇳
