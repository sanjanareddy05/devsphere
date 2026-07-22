import { useState, FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { workspaceApi } from '@/api/workspaces';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface Props {
  onClose: () => void;
}

export default function CreateWorkspaceModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addWorkspace, setActiveWorkspace, setChannels } = useWorkspaceStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { workspace, channels } = await workspaceApi.create(name.trim());
      const workspaceWithRole = { ...workspace, role: workspace.role ?? 'admin' };
      addWorkspace(workspaceWithRole);
      setActiveWorkspace(workspaceWithRole);
      setChannels(channels);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New workspace</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Workspace name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Acme Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              minLength={2}
              maxLength={80}
            />
          </div>

          <p className="text-xs text-slate-500">A default <span className="text-slate-300 font-mono">#general</span> channel will be created automatically.</p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading || !name.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
