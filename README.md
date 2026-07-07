# MarkOne — AI Smart Assessment Platform

A full-stack teacher/student assessment platform: React + Vite + Tailwind frontend, Node/Express + MongoDB backend, JWT auth, and pluggable AI/OCR services.

## What's included and working right now

- Teacher registration + mobile OTP verification + login (JWT + bcrypt, 12 salt rounds)
- Passwordless student join via class code (no email/password, per spec)
- Class creation with auto-generated unique class codes
- Manual question bank (create/edit/bulk-delete/search/filter) with duplicate detection
- "Paste Questions" parser (turns pasted text/ChatGPT output into structured questions)
- Test builder: time limit, negative marking, shuffle questions/options, auto-submit, retest control
- Full test-taking flow: timer, question palette, mark-for-review, auto-save-on-submit, auto-submit at time-up
- Auto-graded results: score, percentage, correct/wrong/skipped, per-chapter strong/weak breakdown
- Teacher reports: class report, question-wise wrong-answer analysis, Excel export, PDF export
- Security: Helmet, CORS allow-list, rate limiting, Mongo query sanitization, XSS input cleaning, data isolation between teachers, pagination everywhere a list could grow large

## What's stubbed, ready for your API keys

These need real third-party accounts, so they're wired up as clean service modules you can drop your keys into rather than faked:

- `backend/services/aiService.js` — AI question generation from lesson text/prompts, AI diagram generation (connect Anthropic, OpenAI, or any LLM API)
- `backend/services/ocrService.js` — PDF/image/camera-scan text extraction (connect Google Vision, AWS Textract, or Tesseract.js for a free offline option)
- Cloudinary image storage (add your credentials to `.env`, then wire uploads through `multer` + the Cloudinary SDK in a new `routes/uploadRoutes.js`)
- SMS/OTP delivery (`backend/utils/otp.js` currently logs OTPs to the console in dev mode — add a real SMS provider for production)

## Handling 500+ students

Nothing here needs special "at scale" work — MongoDB comfortably handles thousands of students on the free Atlas tier. The things that actually matter are already in place:
- Compound indexes on `Student` (`class + rollNumber` unique, `teacher + className + section`) so roster lookups stay fast
- A denormalized `studentCount` on `Class` so you never run a COUNT() over the full roster just to show a dashboard number
- Pagination on every list endpoint that could return hundreds of rows (`/classes/:id/students`, `/questions`)
- Aggregation pipelines (not app-level loops) for class reports, so grading 500 students' attempts happens in the database, not in Node

## Local setup

### 1. Backend
```bash
cd backend
cp .env.example .env     # then fill in MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev               # http://localhost:5000
```

Get a free `MONGO_URI` from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas): create a free cluster, add a database user, allow your IP (or 0.0.0.0/0 for early testing), and copy the connection string.

Generate a strong `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env      # point VITE_API_URL at your backend
npm install
npm run dev                # http://localhost:5173
```

## Deployment

- **Frontend → Vercel**: import the `frontend` folder as a project, set `VITE_API_URL` to your deployed backend URL in Vercel's environment variables.
- **Backend → Render or Railway**: import the `backend` folder, set the same environment variables from `.env.example` (Mongo URI, JWT secret, etc.) in the platform's dashboard — never commit `.env` itself.
- Update `CLIENT_URL` in the backend's environment to your deployed frontend URL so CORS allows it.

## Security checklist already applied

- Passwords hashed with bcrypt (12 rounds), never returned in API responses
- JWT-based auth with role checks (`teacher` vs `student`) on every protected route
- Rate limiting on auth endpoints (20 requests / 15 min) and general API (300 / 15 min)
- `express-mongo-sanitize` strips `$`/`.` operators from user input to block NoSQL injection
- `xss-clean` strips malicious HTML/script from user input
- Helmet sets secure HTTP headers
- Teacher data isolation: every query is scoped to `req.user._id`, so one teacher can never read or edit another's classes, questions, or tests
- No stack traces leaked to clients in production

## Next build priorities

1. Wire a real LLM key into `aiService.js` to light up the AI question/diagram generators
2. Wire Tesseract.js (free, no key needed) or a cloud OCR API into `ocrService.js` for PDF/image/camera question import
3. Add Cloudinary upload route for question images and AI-generated diagrams
4. Add a real SMS provider for OTP delivery in production
