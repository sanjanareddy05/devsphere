import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
      <CheckCircle2 className="w-3 h-3" />
      {text}
    </span>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pw = form.password;
  const rules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rules.length || !rules.upper || !rules.number) return;
    setLoading(true);
    setError('');
    try {
      const { user, accessToken } = await authApi.register(form);
      setAuth(user, accessToken);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 mb-4">
            <span className="text-brand text-2xl font-bold font-mono">D</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Join DevSphere and start collaborating</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
              {pw.length > 0 && (
                <div className="flex gap-3 flex-wrap pt-1">
                  <PasswordRule met={rules.length} text="8+ chars" />
                  <PasswordRule met={rules.upper} text="Uppercase" />
                  <PasswordRule met={rules.number} text="Number" />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={loading || !rules.length || !rules.upper || !rules.number}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
