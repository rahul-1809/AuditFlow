import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please provide both username/email and password.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        <div className="login-header">
          <div className="login-brand-icon">AJ</div>
          <h1 className="login-title">AJ Associates</h1>
          <p className="login-subtext">Tax & Accounting Solutions</p>
        </div>

        {error && (
          <div className="login-alert-banner">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Username or Email
            </label>
            <div className="input-with-icon">
              <Mail size={15} className="input-icon" />
              <input
                id="login-email"
                type="text"
                className="form-input"
                placeholder="e.g. admin@auditflow.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="input-with-icon">
              <Lock size={15} className="input-icon" />
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-credentials-box">
          <div className="demo-header">
            <ShieldCheck size={14} />
            <span>Pre-configured Demo Accounts</span>
          </div>
          <div className="demo-actions-grid">
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => handleDemoFill('admin@auditflow.internal', 'admin123')}
            >
              <strong>Admin:</strong> CA Rajesh Sharma
            </button>
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => handleDemoFill('priya@auditflow.internal', 'assistant123')}
            >
              <strong>Assistant 1:</strong> Priya Patel
            </button>
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => handleDemoFill('amit@auditflow.internal', 'assistant123')}
            >
              <strong>Assistant 2:</strong> Amit Verma
            </button>
          </div>
          <div className="demo-direct-row">
            <span className="direct-login-label">Instant Login:</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => loginAsDemo('admin')}
            >
              Enter as Admin
            </button>
            <span>•</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => loginAsDemo('assistant', 0)}
            >
              Enter as Assistant
            </button>
          </div>
        </div>

        <div className="login-footer-notice">
          Internal system. Public sign-up is disabled. Contact system administrator for credentials.
        </div>
      </div>
    </div>
  );
};
