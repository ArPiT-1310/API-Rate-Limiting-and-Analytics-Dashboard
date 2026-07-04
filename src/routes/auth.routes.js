import { Router } from 'express';
const router = Router();
import { signup, login, refresh, getMe } from '../controllers/auth.controller.js';
import verifyToken from '../middleware/verifyToken.js';

// POST /auth/signup - User registration
router.post('/signup', signup);

// POST /auth/login - User login
router.post('/login', login);

// POST /auth/refresh - Refresh access token
router.post('/refresh', refresh);

// GET /auth/me - Retrieve logged in user's profile
router.get('/me', verifyToken, getMe);

export default router;
