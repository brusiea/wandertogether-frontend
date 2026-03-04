import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password);
        if (error) setError(error.message);
      } else {
        const { error } = await signUp(form.email, form.password, form.fullName);
        if (error) setError(error.message);
        else setError(''); // will redirect via auth listener
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-box">
        <div className="login-logo">Wander<em>Together</em></div>
        <p className="login-tagline">Plan trips together, beautifully.</p>

        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign In</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create Account</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {mode === 'signup' && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" name="fullName" placeholder="Alex Johnson"
              value={form.fullName} onChange={handle} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" name="email" type="email" placeholder="you@email.com"
            value={form.email} onChange={handle} />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" name="password" type="password" placeholder="••••••••"
            value={form.password} onChange={handle}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
        </button>
      </div>
    </div>
  );
}