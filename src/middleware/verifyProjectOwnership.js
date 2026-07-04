import mongoose from 'mongoose';
import Project from '../models/Project.js';

/**
 * Middleware to verify that the requested project exists and is owned by the authenticated user.
 * - Returns 404 if the project does not exist or the id is invalid.
 * - Returns 403 if the project belongs to a different user.
 * - Attaches req.project and calls next() on success.
 */
const verifyProjectOwnership = async (req, res, next) => {
  const { id } = req.params;

  // Validate ObjectId format to prevent Mongoose CastError
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Ownership check — never leak project details in a 403
    if (project.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access forbidden: You do not own this project' });
    }

    // Attach to request for downstream controllers
    req.project = project;
    next();
  } catch (error) {
    console.error('verifyProjectOwnership Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

export default verifyProjectOwnership;
