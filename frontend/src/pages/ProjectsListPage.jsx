import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjectsApi } from '../api/projects.api.js';
import ProjectCard from '../components/ProjectCard';

const ProjectsListPage = () => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getProjectsApi();
      setProjects(data);
    } catch (err) {
      console.error(err);
      if (err.response) {
        setError(err.response.data?.error || 'Failed to fetch projects.');
      } else if (err.request) {
        setError('Cannot reach the server. Make sure the backend is running.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="dashboard-container">
      {/* Top Navbar */}
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

      {/* Main Dashboard Section */}
      <main className="dashboard-main">
        <div className="section-header">
          <div>
            <h2>My Projects</h2>
            <p className="subtitle">Configure and monitor rate limit policies for your API endpoints</p>
          </div>
          <Link to="/projects/new" className="btn-primary btn-with-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Project
          </Link>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
            <button onClick={fetchProjects} className="btn-retry">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state glassmorphism">
            <div className="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </div>
            <h3>No projects found</h3>
            <p>Get started by creating your first project to proxy and rate-limit your API requests.</p>
            <Link to="/projects/new" className="btn-primary mt-4">
              Create Project
            </Link>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectsListPage;
