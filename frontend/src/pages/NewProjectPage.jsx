import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createProjectApi } from '../api/projects.api.js';

const NewProjectPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [targetBaseUrl, setTargetBaseUrl] = useState('');
  const [maxRequests, setMaxRequests] = useState(100);
  const [windowSeconds, setWindowSeconds] = useState(60);
  
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    targetBaseUrl: '',
    maxRequests: '',
    windowSeconds: ''
  });
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    let isValid = true;
    const errors = { name: '', targetBaseUrl: '', maxRequests: '', windowSeconds: '' };

    if (!name.trim()) {
      errors.name = 'Project name is required';
      isValid = false;
    }

    if (!targetBaseUrl.trim()) {
      errors.targetBaseUrl = 'Target URL is required';
      isValid = false;
    } else if (!/^https?:\/\//i.test(targetBaseUrl)) {
      errors.targetBaseUrl = 'Target URL must start with http:// or https://';
      isValid = false;
    }

    if (!maxRequests || maxRequests <= 0) {
      errors.maxRequests = 'Requests limit must be greater than 0';
      isValid = false;
    }

    if (!windowSeconds || windowSeconds <= 0) {
      errors.windowSeconds = 'Time window must be greater than 0 seconds';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const projectData = {
        name: name.trim(),
        targetBaseUrl: targetBaseUrl.trim(),
        rateLimit: {
          maxRequests: parseInt(maxRequests, 10),
          windowMs: parseInt(windowSeconds, 10) * 1000
        }
      };

      const newProject = await createProjectApi(projectData);
      // Redirect to settings page for the newly created project
      navigate(`/projects/${newProject.id || newProject._id}/settings`);
    } catch (err) {
      console.error(err);
      if (err.response) {
        setError(err.response.data?.error || 'Failed to create project.');
      } else if (err.request) {
        setError('Cannot reach server. Verify that backend is running.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <header className="dashboard-header glassmorphism">
        <div className="brand">
          <span className="brand-logo">AG</span>
          <h1>Antigravity Limiter</h1>
        </div>
        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button onClick={logout} id="logout-btn" className="btn-logout">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main max-width-md">
        <div className="breadcrumb">
          <Link to="/projects">← Back to Projects</Link>
        </div>

        <div className="section-header">
          <div>
            <h2>Create New Project</h2>
            <p className="subtitle">Set up proxy endpoints and define access control limits</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="project-form glassmorphism">
          <div className="form-group">
            <label htmlFor="name">Project Name</label>
            <input
              type="text"
              id="name"
              placeholder="e.g. Production API"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: '' }));
              }}
              required
              disabled={loading}
              className={`form-input ${validationErrors.name ? 'input-error' : ''}`}
            />
            {validationErrors.name && <span className="inline-error">{validationErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="targetBaseUrl">Target Base URL</label>
            <input
              type="text"
              id="targetBaseUrl"
              placeholder="e.g. https://api.mycompany.com"
              value={targetBaseUrl}
              onChange={(e) => {
                setTargetBaseUrl(e.target.value);
                if (validationErrors.targetBaseUrl) setValidationErrors(prev => ({ ...prev, targetBaseUrl: '' }));
              }}
              required
              disabled={loading}
              className={`form-input ${validationErrors.targetBaseUrl ? 'input-error' : ''}`}
            />
            <p className="field-hint">The upstream server where proxy requests will be forwarded.</p>
            {validationErrors.targetBaseUrl && <span className="inline-error">{validationErrors.targetBaseUrl}</span>}
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="maxRequests">Max Requests</label>
              <input
                type="number"
                id="maxRequests"
                min="1"
                value={maxRequests}
                onChange={(e) => {
                  setMaxRequests(e.target.value);
                  if (validationErrors.maxRequests) setValidationErrors(prev => ({ ...prev, maxRequests: '' }));
                }}
                required
                disabled={loading}
                className={`form-input ${validationErrors.maxRequests ? 'input-error' : ''}`}
              />
              {validationErrors.maxRequests && <span className="inline-error">{validationErrors.maxRequests}</span>}
            </div>

            <div className="form-group flex-1">
              <label htmlFor="windowSeconds">Per (Seconds)</label>
              <input
                type="number"
                id="windowSeconds"
                min="1"
                value={windowSeconds}
                onChange={(e) => {
                  setWindowSeconds(e.target.value);
                  if (validationErrors.windowSeconds) setValidationErrors(prev => ({ ...prev, windowSeconds: '' }));
                }}
                required
                disabled={loading}
                className={`form-input ${validationErrors.windowSeconds ? 'input-error' : ''}`}
              />
              {validationErrors.windowSeconds && <span className="inline-error">{validationErrors.windowSeconds}</span>}
            </div>
          </div>

          <div className="form-actions">
            <Link to="/projects" id="cancel-create-btn" className="btn-secondary">Cancel</Link>
            <button type="submit" id="create-project-submit-btn" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default NewProjectPage;
