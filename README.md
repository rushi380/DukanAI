# DukanAI — आपकी दुकान का डिजिटल मुंशी

Voice + WhatsApp inventory management for Indian kirana shops.

---

## Project Structure

```
dukanai/
├── backend/
│   ├── models/
│   │   ├── Item.js          ← Product schema (Hindi fields)
│   │   └── SaleLog.js       ← Every stock change log
│   ├── routes/
│   │   ├── items.js         ← Full CRUD + stock update API
│   │   ├── voice.js         ← Hindi NLP parser (Gemini AI)
│   │   ├── bill.js          ← Bill photo scan (Gemini Vision)
│   │   └── alerts.js        ← WhatsApp alert triggers
│   ├── services/
│   │   └── whatsapp.js      ← Twilio WhatsApp integration
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx       ← Hindi sidebar navigation
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    ← Stats + recent activity
│   │   │   ├── VoiceInput.jsx   ← Mic button + Hindi NLP
│   │   │   ├── Inventory.jsx    ← Full CRUD in Hindi
│   │   │   ├── BillScan.jsx     ← Photo upload + AI read
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
| NLP | Google Gemini Pro API |
| Bill Scan | Google Gemini Pro Vision API |
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| WhatsApp | Twilio WhatsApp API |
| Language | Hindi (Devanagari) UI |

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

POST   /api/voice/parse        → Parse Hindi voice text
POST   /api/bill/scan          → Scan bill image

GET    /api/alerts             → Low/out stock list
POST   /api/alerts/daily-summary → Send WhatsApp summary
POST   /api/alerts/send        → Send custom WhatsApp message
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
   - `TWILIO_WHATSAPP_NUMBER` — Twilio WhatsApp sandbox number
   - `SHOP_WHATSAPP_NUMBER` — Your WhatsApp number (whatsapp:+91XXXXXXXXXX)
   - `CORS_ORIGIN` — Leave empty (auto-configured)

4. **Deploy** → Vercel automatically:
   - Builds frontend (React + Vite)
   - Deploys backend as serverless functions
   - Routes `/api/*` to backend, static files to frontend

5. **Update Frontend API URL** (if not using root domain):
   - Create `.env.local` in `frontend/` directory
   - Add: `VITE_API_URL=https://your-vercel-deployment.vercel.app/api`

### Deployment Status
- Frontend: Automatic (every push to `main`)
- Backend: Automatic serverless function deployment
- Database: Connected via MongoDB Atlas

---

## 🛠️ Troubleshooting

**Issue: CORS errors in frontend?**
- Check `CORS_ORIGIN` env variable in Vercel dashboard
- Should match your Vercel deployment URL

**Issue: API calls return 404?**
- Verify backend environment variables are set in Vercel
- Check that `.env` file is NOT committed (should be in `.gitignore`)

**Issue: Multer file upload fails?**
- Vercel has limitations on temp file storage
- Use Cloudinary/Firebase Storage for production file uploads

---

## 📝 License
Open source for Indian kirana shops 🇮🇳
