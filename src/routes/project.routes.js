import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  regenerateApiKey,
} from '../controllers/project.controller.js';
import verifyToken from '../middleware/verifyToken.js';
import verifyProjectOwnership from '../middleware/verifyProjectOwnership.js';

const router = Router();

// Apply authorization check on all project endpoints
router.use(verifyToken);

// POST /projects - Create a project
router.post('/create', createProject);

// GET /projects - Get all projects for logged-in user
router.get('/get', getProjects);

// GET /projects/:id - Get a project by ID (Gated by ownership verification)
router.get('/get/:id', verifyProjectOwnership, getProjectById);

// PATCH /projects/:id - Update specific fields of a project (Gated by ownership verification)
router.patch('/update/:id', verifyProjectOwnership, updateProject);

// DELETE /projects/:id - Delete a project (Gated by ownership verification)
router.delete('/delete/:id', verifyProjectOwnership, deleteProject);

// POST /projects/:id/regenerate-key - Regenerate API Key (Gated by ownership verification)
router.post('/regenerate/:id', verifyProjectOwnership, regenerateApiKey);

export default router;
