import { useState, FormEvent } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { workspaceApi } from '@/api/workspaces';

interface Props {
  workspaceId: string;
  onClose: () => void;
}

export default function InviteModal({ workspaceId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await workspaceApi.invite(workspaceId, email.trim(), role);
      setInviteToken(res.token || '');
      setSuccess(`Invite link ready for ${res.email}. Open the link below to accept it.`);
      setEmail('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Invite members</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
          {success && (
            <div className="space-y-2 text-sm text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {success}
              </div>
              <a href={workspaceApi.buildInviteUrl(inviteToken)} className="text-xs underline break-all" target="_blank" rel="noreferrer">
                Open invite link
              </a>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email address</label>
            <input
              type="email"
              className="input"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Close</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
