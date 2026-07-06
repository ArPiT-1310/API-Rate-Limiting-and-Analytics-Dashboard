import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getProjectByIdApi, 
  updateProjectApi, 
  deleteProjectApi, 
  regenerateApiKeyApi 
} from '../api/projects.api.js';

const ProjectSettingsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Project state
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [targetBaseUrl, setTargetBaseUrl] = useState('');
  const [maxRequests, setMaxRequests] = useState(100);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [apiKey, setApiKey] = useState('');

  // Page states
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);
  
  // Custom dialogs/confirmations state
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Copy and Reveal state
  const [revealKey, setRevealKey] = useState(false);
  const [copyKeySuccess, setCopyKeySuccess] = useState(false);
  const [copyProxySuccess, setCopyProxySuccess] = useState(false);

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError('');
      setIsForbidden(false);
      const data = await getProjectByIdApi(id);
      
      setProject(data);
      setName(data.name);
      setTargetBaseUrl(data.targetBaseUrl);
      setApiKey(data.apiKey);
      if (data.rateLimit) {
        setMaxRequests(data.rateLimit.maxRequests);
        setWindowSeconds(Math.round((data.rateLimit.windowMs || 60000) / 1000));
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setIsForbidden(true);
      } else if (err.response?.status === 404) {
        setError('Project not found.');
      } else if (err.response) {
        setError(err.response.data?.error || 'Failed to load project details.');
      } else if (err.request) {
        setError('Cannot reach server. Make sure the backend is running.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    if (!targetBaseUrl.trim() || !/^https?:\/\//i.test(targetBaseUrl)) {
      setError('Target URL must start with http:// or https://');
      return;
    }

    setSaveLoading(true);
    try {
      const updatedData = {
        name: name.trim(),
        targetBaseUrl: targetBaseUrl.trim(),
        rateLimit: {
          maxRequests: parseInt(maxRequests, 10),
          windowMs: parseInt(windowSeconds, 10) * 1000
        }
      };

      const result = await updateProjectApi(id, updatedData);
      setProject(result);
      setSuccessMsg('Project settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      if (err.response) {
        setError(err.response.data?.error || 'Failed to update project settings.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const result = await regenerateApiKeyApi(id);
      setApiKey(result.apiKey);
      setProject(prev => ({ ...prev, apiKey: result.apiKey }));
      setShowRegenConfirm(false);
      setSuccessMsg('API key regenerated successfully! Make sure to update your clients.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
      setError('Failed to regenerate API key.');
    }
  };

  const handleDeleteProject = async () => {
    setError('');
    try {
      await deleteProjectApi(id);
      navigate('/projects');
    } catch (err) {
      console.error(err);
      setError('Failed to delete project. Please try again.');
    }
  };

  const getMaskedKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const proxyUrl = apiKey ? `${backendBaseUrl}/proxy/${apiKey}/` : '';

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopyKeySuccess(true);
      setTimeout(() => setCopyKeySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy API key', err);
    }
  };

  const handleCopyProxy = async () => {
    try {
      await navigator.clipboard.writeText(proxyUrl);
      setCopyProxySuccess(true);
      setTimeout(() => setCopyProxySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Proxy URL', err);
    }
  };

  // 403 Forbidden Access Screen
  if (isForbidden) {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header glassmorphism">
          <div className="brand">
            <span className="brand-logo">AG</span>
            <h1>Antigravity Limiter</h1>
          </div>
          <button onClick={logout} className="btn-logout">Logout</button>
        </header>
        <main className="dashboard-main flex-center">
          <div className="forbidden-card glassmorphism">
            <div className="forbidden-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2>Access Denied</h2>
            <p>You don't have access to this project. It might be owned by another user or no longer exist.</p>
            <Link to="/projects" className="btn-primary mt-4">
              Return to My Projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
          <button onClick={logout} className="btn-logout">
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
            <h2>Project Settings</h2>
            <p className="subtitle">Manage credentials, endpoints, and rate limiting thresholds</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading project details...</p>
          </div>
        ) : (
          <div className="settings-grid">
            {/* API Credentials Card */}
            <div className="settings-card glassmorphism mb-6">
              <h3>API Credentials</h3>
              <p className="card-desc">Use these credentials to authenticate requests routed through the rate limiting proxy.</p>
              
              <div className="info-group mt-4">
                <label>API Key</label>
                <div className="interactive-key-container">
                  <span className="key-display font-mono">
                    {revealKey ? apiKey : getMaskedKey(apiKey)}
                  </span>
                  <div className="key-actions">
                    <button 
                      type="button" 
                      className="btn-icon" 
                      onClick={() => setRevealKey(!revealKey)} 
                      title={revealKey ? "Hide API Key" : "Reveal API Key"}
                    >
                      {revealKey ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                    <button 
                      type="button" 
                      className={`btn-action-small ${copyKeySuccess ? 'copied' : ''}`} 
                      onClick={handleCopyKey}
                    >
                      {copyKeySuccess ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="info-group">
                <label>Proxy Target URL</label>
                <div className="interactive-key-container">
                  <span className="key-display font-mono proxy-display truncate-text" title={proxyUrl}>
                    {proxyUrl}
                  </span>
                  <button 
                    type="button" 
                    className={`btn-action-small ${copyProxySuccess ? 'copied' : ''}`} 
                    onClick={handleCopyProxy}
                  >
                    {copyProxySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="field-hint">Route client API requests through this endpoint instead of directly calling your target server.</p>
              </div>

              <div className="danger-zone-inline mt-4">
                {!showRegenConfirm ? (
                  <button 
                    type="button" 
                    className="btn-danger-outline" 
                    onClick={() => setShowRegenConfirm(true)}
                  >
                    Regenerate API Key
                  </button>
                ) : (
                  <div className="confirm-box glassmorphism warning-border">
                    <p className="warning-text">
                      <strong>Warning:</strong> Regenerating the API Key will immediately invalidate the active key. All clients currently using it will be blocked.
                    </p>
                    <div className="confirm-actions">
                      <button 
                        type="button" 
                        className="btn-danger" 
                        onClick={handleRegenerateKey}
                      >
                        Yes, Regenerate
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => setShowRegenConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Project Form */}
            <form onSubmit={handleSave} className="project-form glassmorphism mb-6">
              <h3>Project Configuration</h3>
              <p className="card-desc">Modify the target server details and rate limiting policy rules.</p>
              
              <div className="form-group mt-4">
                <label htmlFor="name">Project Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={saveLoading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="targetBaseUrl">Target Base URL</label>
                <input
                  type="text"
                  id="targetBaseUrl"
                  value={targetBaseUrl}
                  onChange={(e) => setTargetBaseUrl(e.target.value)}
                  required
                  disabled={saveLoading}
                  className="form-input"
                />
                <p className="field-hint">Upstream destination URL (must start with http:// or https://).</p>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="maxRequests">Max Requests</label>
                  <input
                    type="number"
                    id="maxRequests"
                    min="1"
                    value={maxRequests}
                    onChange={(e) => setMaxRequests(e.target.value)}
                    required
                    disabled={saveLoading}
                    className="form-input"
                  />
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="windowSeconds">Per (Seconds)</label>
                  <input
                    type="number"
                    id="windowSeconds"
                    min="1"
                    value={windowSeconds}
                    onChange={(e) => setWindowSeconds(e.target.value)}
                    required
                    disabled={saveLoading}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions border-top">
                <button type="submit" className="btn-primary" disabled={saveLoading}>
                  {saveLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Danger Zone Card */}
            <div className="settings-card glassmorphism border-danger">
              <h3 className="text-danger">Danger Zone</h3>
              <p className="card-desc">Permanently remove this project. This operation cannot be undone and will delete all associated logs and credentials.</p>
              
              <div className="danger-zone-inline mt-4">
                {!showDeleteConfirm ? (
                  <button 
                    type="button" 
                    className="btn-danger" 
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Project
                  </button>
                ) : (
                  <div className="confirm-box glassmorphism danger-border">
                    <p className="warning-text text-danger">
                      <strong>Critical Warning:</strong> This action is permanent. Deleting the project will delete all proxy routes and rate-limiting configs permanently.
                    </p>
                    <div className="confirm-actions">
                      <button 
                        type="button" 
                        className="btn-danger" 
                        onClick={handleDeleteProject}
                      >
                        Confirm Delete
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectSettingsPage;
