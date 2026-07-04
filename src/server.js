import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import connectDB from './db/db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Setup CORS with credentials support for httpOnly cookies
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse incoming request body and cookies
app.use(express.json());
app.use(cookieParser());

// Mount the Auth Service routes
app.use('/auth', authRoutes);

// Mount the Project Service routes
app.use('/projects', projectRoutes);

// Global Error Handler for unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Connect to MongoDB and then start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Auth Service server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server due to DB connection error:', err);
    process.exit(1);
  });

