import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Inline/client-side validation errors
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    email: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    let isValid = true;
    const errors = { name: '', email: '', password: '' };

    if (!name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Run client-side validation
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password);
      navigate('/projects');
    } catch (err) {
      console.error(err);
      if (err.response) {
        // Backend validation or conflict error
        setError(err.response.data?.error || 'Registration failed. Email might already be registered.');
      } else if (err.request) {
        // Server down
        setError('Cannot connect to the server. Please check if the backend is running.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glassmorphism">
        <div className="auth-header">
          <div className="brand-logo">AG</div>
          <h2>Create account</h2>
          <p className="subtitle">Start proxying and rate limiting your API requests today</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              placeholder="John Doe"
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
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: '' }));
              }}
              required
              disabled={loading}
              className={`form-input ${validationErrors.email ? 'input-error' : ''}`}
            />
            {validationErrors.email && <span className="inline-error">{validationErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password (min 6 chars)</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: '' }));
              }}
              required
              disabled={loading}
              className={`form-input ${validationErrors.password ? 'input-error' : ''}`}
            />
            {validationErrors.password && <span className="inline-error">{validationErrors.password}</span>}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in instead</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
