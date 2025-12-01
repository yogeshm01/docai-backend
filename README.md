# DocAI Backend

Node.js/Express API that lets authenticated users upload PDF/DOCX files, extract searchable text, and ask Gemini-powered questions about each document. Data is stored via Prisma + SQLite by default, and files reside in `src/uploads/`.

## Features
- User registration/login with hashed passwords and JWT auth.
- Document management: list, search, paginate, duplicate, update metadata, replace files, and delete (single or bulk).
- File uploads via Multer with on-disk storage.
- Multi-strategy text extraction (pdf-parse, pdf2json, mammoth, `pdftotext`).
- Question answering using Google Gemini (`gemini-2.0-flash`).

## Tech Stack
- Node , Express , CORS
- Prisma ORM with SQLite (swap `DATABASE_URL` for other providers)
- Multer, pdf-parse, pdf2json, mammoth
- JWT for auth, Bcrypt for hashing


## ⚙️ Run Locally

```bash
# 1. Clone
git clone https://github.com/yogeshm01/docai-backend.git
cd docai-backend

# 2. Install deps
npm install

# 3. Configure Prisma schema & database
npx prisma migrate dev   # or migrate deploy in CI

# 4. Start the API
npm start                # defaults to http://localhost:8000
```

## Environment Variables
| Name | Description |
| --- | --- |
| `DATABASE_URL` | Prisma connection string (SQLite example: `file:./prisma/dev.db`). |
| `JWT_SECRET` | Secret used to sign/verify JWT tokens. |
| `GEMINI_API_KEY` | Google AI Studio key for answering document questions. |
| `PORT` | (Optional) HTTP port; defaults to `8000`. |

---

## API Outline
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | ❌ | Create user (unique username/email). |
| `POST` | `/api/auth/login` | ❌ | Returns JWT + profile. |
| `GET` | `/api/documents` | ✅ | Paginated list w/ search + filters. |
| `POST` | `/api/documents` | ✅  | Upload DOCX/PDF (multipart). |
| `GET` | `/api/documents/:id` | ✅ | Fetch metadata (owner-only). |
| `POST` | `/api/documents/:id/duplicate` | ✅ | Clone metadata + file copy. |
| `POST` | `/api/documents/:id/ask` | ✅ | Send question to Gemini using extracted text. |
| `PATCH` | `/api/documents/:id` | ✅ | Update title only. |
| `PATCH` | `/api/documents/:id/file` | ✅ | Replace stored document. |
| `DELETE` | `/api/documents/:id` | ✅ | Delete single document + file. |
| `DELETE` | `/api/documents` | ✅ | Bulk delete via `{ ids: number[] }`. |

All protected routes require `Authorization: Bearer <JWT>` and pass through `authMiddleware`.

---

## 🗂 Project Structure

```
src/
├─ app.js              # Express app + CORS + routes
├─ server.js           # Entry point
├─ prismaClient.js     # Prisma singleton
├─ controllers/
│   ├─ authController.js
│   └─ documentController.js
├─ routes/
│   ├─ authRoutes.js
│   └─ documentRoutes.js
├─ middleware/
│   └─ authMiddleware.js
├─ services/
│   └─ extractText.js
└─ uploads/            # Saved files (gitignored)
```

---

## 🌐 Deployments

- **Frontend** (React + Tailwind): https://sabapplier-frontend.vercel.app/  
- **Backend** (this repo): https://docai-backend-nnvs.onrender.com  
- **Repository**: https://github.com/yogeshm01/docai-backend

> When deploying to Render, remember to add the `.env` variables and ensure the `src/uploads` folder is writable (use persistent disk if needed).

---

## 🧰 Troubleshooting

- **CORS blocked?** Update the `cors` config in `src/app.js` to include your frontend origin(s).  
- **Gemini errors / timeouts?** Confirm `GEMINI_API_KEY`, billing, and outbound internet access.  
- **Text extraction empty?** Ensure the PDF has selectable text or install Poppler for `pdftotext`.  
- **Duplicate user errors?** Prisma throws `P2002`; the API now responds with “Username/Email already exists.”  

## File Storage
Uploaded files land in `src/uploads/`. Clean-up is handled when documents are deleted or files are replaced, but ensure the directory is writeable in your deployment (Render, etc.).


Built with ❤️ by [Yogesh Mishra](https://github.com/yogeshm01).

