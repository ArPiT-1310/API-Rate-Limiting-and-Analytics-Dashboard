import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  const [revealKey, setRevealKey] = useState(false);
  const [copyKeySuccess, setCopyKeySuccess] = useState(false);
  const [copyProxySuccess, setCopyProxySuccess] = useState(false);

  // Mask the API key (e.g., abc1****xyz9)
  const getMaskedKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const proxyUrl = `${backendBaseUrl}/proxy/${project.apiKey}/`;

  const handleCopyKey = async (e) => {
    e.stopPropagation(); // Prevent navigating to settings
    try {
      await navigator.clipboard.writeText(project.apiKey);
      setCopyKeySuccess(true);
      setTimeout(() => setCopyKeySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy API key', err);
    }
  };

  const handleCopyProxy = async (e) => {
    e.stopPropagation(); // Prevent navigating to settings
    try {
      await navigator.clipboard.writeText(proxyUrl);
      setCopyProxySuccess(true);
      setTimeout(() => setCopyProxySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy Proxy URL', err);
    }
  };

  const toggleReveal = (e) => {
    e.stopPropagation(); // Prevent navigating to settings
    setRevealKey(!revealKey);
  };

  return (
    <div className="project-card" onClick={() => navigate(`/projects/${project.id || project._id}/settings`)}>
      <div className="project-card-header">
        <h3 className="project-title">{project.name}</h3>
        <span className="rate-limit-badge">
          {project.rateLimit?.maxRequests} req / {(project.rateLimit?.windowMs || 60000) / 1000}s
        </span>
      </div>

      <div className="project-card-body">
        <div className="info-group">
          <label>Target URL</label>
          <div className="info-value target-url">{project.targetBaseUrl}</div>
        </div>

        <div className="info-group">
          <label>API Key</label>
          <div className="interactive-key-container">
            <span className="key-display font-mono">
              {revealKey ? project.apiKey : getMaskedKey(project.apiKey)}
            </span>
            <div className="key-actions">
              <button 
                type="button" 
                className="btn-icon" 
                onClick={toggleReveal} 
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
          <label>Proxy URL</label>
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
        </div>
      </div>
      
      <div className="project-card-footer">
        <span className="settings-link">
          Configure settings
          <svg className="arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>
    </div>
  );
};

export default ProjectCard;
