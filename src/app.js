import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

const app = express();
app.use(cors({ origin: ["http://localhost:3000", "https://sabapplier-frontend.vercel.app"] }));
app.use(express.json());
app.use('/uploads', express.static('src/uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

export default app;
