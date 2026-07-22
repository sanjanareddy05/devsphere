import { useState, useRef, KeyboardEvent, useCallback } from 'react';
import { Send, Smile } from 'lucide-react';
import { getActiveSocket } from '@/socket';
import { useAuthStore } from '@/store/authStore';

interface Props {
  channelId: string;
  workspaceId: string;
  channelName: string;
}

const COMMON_EMOJIS = ['👍', '❤️', '🎉', '🚀', '🔥', '👀', '✅', '😄'];

export default function MessageInput({ channelId, workspaceId, channelName }: Props) {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useAuthStore((s) => s.user);

  const emitTyping = useCallback(() => {
    const socket = getActiveSocket();
    if (!socket) return;
    if (!isTypingRef.current) {
      socket.emit('typing', { channelId });
      isTypingRef.current = true;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop_typing', { channelId });
      isTypingRef.current = false;
    }, 2500);
  }, [channelId]);

  const stopTyping = useCallback(() => {
    const socket = getActiveSocket();
    if (socket && isTypingRef.current) {
      socket.emit('stop_typing', { channelId });
      isTypingRef.current = false;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [channelId]);

  const sendMessage = useCallback(() => {
    const content = value.trim();
    if (!content || !user) return;
    const socket = getActiveSocket();
    if (!socket) return;

    socket.emit('send_message', { channelId, workspaceId, content });
    setValue('');
    stopTyping();
    setShowEmoji(false);
  }, [value, channelId, workspaceId, user, stopTyping]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (v: string) => {
    setValue(v);
    if (v.trim()) emitTyping();
    else stopTyping();
  };

  return (
    <div className="px-4 py-3 border-t border-surface-600 bg-surface-800">
      <div className="relative flex items-end gap-2 bg-surface-700 border border-surface-500 rounded-xl px-3 py-2 focus-within:border-brand/40 transition-colors">
        {/* Emoji picker */}
        <div className="relative self-end mb-0.5">
          <button
            onClick={() => setShowEmoji((s) => !s)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-8 left-0 bg-surface-800 border border-surface-600 rounded-xl p-2 flex gap-1 shadow-xl animate-slide-up z-10">
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { setValue((v) => v + e); setShowEmoji(false); }}
                  className="text-xl hover:scale-125 transition-transform p-1"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text area */}
        <textarea
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none max-h-32 leading-relaxed py-0.5"
          placeholder={`Message #${channelName}`}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          style={{ height: 'auto' }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
          }}
        />

        {/* Send button */}
        <button
          onClick={sendMessage}
          disabled={!value.trim()}
          className={`self-end mb-0.5 p-1.5 rounded-lg transition-all ${
            value.trim()
              ? 'text-brand hover:bg-brand/10'
              : 'text-slate-600 cursor-not-allowed'
          }`}
          title="Send (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-slate-600 mt-1.5 px-1">
        <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
