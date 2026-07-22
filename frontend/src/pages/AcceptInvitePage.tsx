import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { workspaceApi } from '@/api/workspaces';
import { useAuthStore } from '@/store/authStore';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Accepting your invite...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No invite token was provided.');
      return;
    }

    workspaceApi.acceptInvite(token)
      .then(() => {
        setStatus('success');
        setMessage('Invite accepted successfully. Redirecting to your workspace...');
        setTimeout(() => navigate('/'), 1500);
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to accept invite.';
        setStatus('error');
        setMessage(msg);
      });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100 flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-semibold mb-3">Workspace invite</h1>
        <p className={status === 'error' ? 'text-red-400' : 'text-slate-300'}>{message}</p>

        {status === 'error' && (
          <div className="mt-4 space-y-2 text-sm text-slate-400">
            <p>Make sure you are signed in with the same email that was invited.</p>
            {user ? (
              <p className="text-slate-300">Signed in as: {user.email}</p>
            ) : (
              <Link to="/login" className="text-brand underline">Sign in to continue</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
