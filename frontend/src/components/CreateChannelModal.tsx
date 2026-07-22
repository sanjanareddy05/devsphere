import { useState, FormEvent } from 'react';
import { X, Hash, Loader2 } from 'lucide-react';
import { workspaceApi, Channel } from '@/api/workspaces';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onCreated: (ch: Channel) => void;
}

export default function CreateChannelModal({ workspaceId, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sanitizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ch = await workspaceApi.channels.create(workspaceId, {
        name: sanitizedName,
        description,
        is_private: isPrivate,
      });
      onCreated(ch);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Create channel</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Name</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                className="input pl-9"
                placeholder="e.g. frontend-team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            {name && sanitizedName !== name && (
              <p className="text-xs text-slate-500">Will be created as <span className="font-mono text-brand">{sanitizedName}</span></p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Description <span className="normal-case text-slate-600">(optional)</span></label>
            <input
              type="text"
              className="input"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <div>
              <p className="text-sm text-slate-200">Private channel</p>
              <p className="text-xs text-slate-500">Only invited members can access it</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading || !sanitizedName}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
