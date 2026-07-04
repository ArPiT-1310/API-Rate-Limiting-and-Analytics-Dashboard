import Project from '../models/Project.js';
import crypto from 'crypto';

/**
 * Validates whether the URL starts with http:// or https://
 */
const isValidUrl = (url) => {
  return /^https?:\/\//.test(url);
};

/**
 * POST /projects
 * Creates a new project for the authenticated user.
 */
export const createProject = async (req, res) => {
  try {
    const { name, targetBaseUrl, rateLimit } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required and cannot be empty' });
    }

    if (!targetBaseUrl || typeof targetBaseUrl !== 'string' || !targetBaseUrl.trim()) {
      return res.status(400).json({ error: 'Target base URL is required and cannot be empty' });
    }

    if (!isValidUrl(targetBaseUrl)) {
      return res.status(400).json({ error: 'Target base URL must start with http:// or https://' });
    }

    const projectData = {
      userId: req.userId, // Authenticated user
      name: name.trim(),
      targetBaseUrl: targetBaseUrl.trim(),
    };

    // Construct rate limit if provided
    if (rateLimit) {
      projectData.rateLimit = {};
      if (rateLimit.windowMs !== undefined) {
        projectData.rateLimit.windowMs = Number(rateLimit.windowMs);
      }
      if (rateLimit.maxRequests !== undefined) {
        projectData.rateLimit.maxRequests = Number(rateLimit.maxRequests);
      }
    }

    const project = new Project(projectData);
    await project.save();

    return res.status(201).json(project);
  } catch (error) {
    console.error('Create Project Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * GET /projects
 * Returns all projects owned by the authenticated user.
 */
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.userId });
    return res.status(200).json(projects);
  } catch (error) {
    console.error('Get Projects Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * GET /projects/:id
 * Returns a specific project. Access is gated by ownership middleware.
 */
export const getProjectById = async (req, res) => {
  try {
    // req.project is attached by verifyProjectOwnership middleware
    return res.status(200).json(req.project);
  } catch (error) {
    console.error('Get Project By ID Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * PATCH /projects/:id
 * Updates specific properties of a project. Gated by ownership middleware.
 */
export const updateProject = async (req, res) => {
  try {
    const { name, targetBaseUrl, rateLimit } = req.body;
    const project = req.project; // Attached by verifyProjectOwnership middleware

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Project name cannot be empty' });
      }
      project.name = name.trim();
    }

    if (targetBaseUrl !== undefined) {
      if (typeof targetBaseUrl !== 'string' || !targetBaseUrl.trim()) {
        return res.status(400).json({ error: 'Target base URL cannot be empty' });
      }
      if (!isValidUrl(targetBaseUrl)) {
        return res.status(400).json({ error: 'Target base URL must start with http:// or https://' });
      }
      project.targetBaseUrl = targetBaseUrl.trim();
    }

    if (rateLimit !== undefined) {
      if (!project.rateLimit) {
        project.rateLimit = {};
      }
      if (rateLimit.windowMs !== undefined) {
        project.rateLimit.windowMs = Number(rateLimit.windowMs);
      }
      if (rateLimit.maxRequests !== undefined) {
        project.rateLimit.maxRequests = Number(rateLimit.maxRequests);
      }
    }

    await project.save();
    return res.status(200).json(project);
  } catch (error) {
    console.error('Update Project Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * DELETE /projects/:id
 * Deletes a project. Gated by ownership middleware.
 */
export const deleteProject = async (req, res) => {
  try {
    const project = req.project; // Attached by verifyProjectOwnership middleware
    await Project.deleteOne({ _id: project._id });
    return res.status(204).send();
  } catch (error) {
    console.error('Delete Project Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * POST /projects/:id/regenerate-key
 * Regenerates the project's apiKey. Gated by ownership middleware.
 */
export const regenerateApiKey = async (req, res) => {
  try {
    const project = req.project; // Attached by verifyProjectOwnership middleware
    project.apiKey = crypto.randomBytes(16).toString('hex');
    await project.save();
    return res.status(200).json(project);
  } catch (error) {
    console.error('Regenerate API Key Error:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
