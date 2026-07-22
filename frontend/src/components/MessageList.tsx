import { useEffect, useRef, useState, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { messagesApi, Message } from '@/api/messages';
import { useAuthStore } from '@/store/authStore';

interface Props {
  channelId: string;
  workspaceId: string;
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  return format(d, 'h:mm a');
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

function Avatar({ name }: { name: string }) {
  const colors = [
    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'bg-rose-500/20 text-rose-300 border-rose-500/30',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 ${colors[idx]}`}>
      {name[0].toUpperCase()}
    </div>
  );
}

export default function MessageList({ channelId, workspaceId }: Props) {
  const user = useAuthStore((s) => s.user);
  const { messagesByChannel, cursors, hasMore, setMessages, prependMessages, typingUsers } = useChatStore();
  const messages = messagesByChannel[channelId] ?? [];
  const cursor = cursors[channelId] ?? undefined;
  const canLoadMore = hasMore[channelId] ?? false;

  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFirstLoad = useRef(true);

  // Initial load
  useEffect(() => {
    isFirstLoad.current = true;
    setLoading(true);
    messagesApi
      .history(channelId)
      .then(({ messages: msgs, nextCursor, hasMore: more }) => {
        setMessages(channelId, msgs, nextCursor, more);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [channelId]);

  // Auto-scroll to bottom on new messages (only if near bottom)
  useEffect(() => {
    if (isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      isFirstLoad.current = false;
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !canLoadMore || !cursor) return;
    const el = containerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    setLoadingMore(true);
    try {
      const { messages: older, nextCursor } = await messagesApi.history(channelId, cursor);
      prependMessages(channelId, older, nextCursor);
      // Restore scroll position after prepend
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } catch (err) {
      console.error('[MessageList] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, cursor, canLoadMore, loadingMore]);

  // Intersection observer for "load more" at top
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (topRef.current) observer.observe(topRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const channelTypers = typingUsers.filter(
    (u) => u.channelId === channelId && u.userId !== user?.id
  );

  // Group messages by day
  type Group = { day: string; msgs: Message[] };
  const grouped: Group[] = [];
  for (const msg of messages) {
    const day = formatDayLabel(msg.createdAt);
    if (grouped.length === 0 || grouped[grouped.length - 1].day !== day) {
      grouped.push({ day, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
      {/* Load more trigger */}
      <div ref={topRef} className="h-1" />
      {loadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-slate-400 font-medium">No messages yet</p>
          <p className="text-slate-600 text-sm mt-1">Be the first to say something!</p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.day}>
          {/* Day separator */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-surface-600" />
            <span className="text-xs text-slate-500 font-medium px-2">{group.day}</span>
            <div className="flex-1 h-px bg-surface-600" />
          </div>

          <div className="space-y-0.5">
            {group.msgs.map((msg, i) => {
              const prev = group.msgs[i - 1];
              const isGrouped = prev && prev.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
              const isOwn = msg.senderId === user?.id;

              return (
                <div
                  key={msg._id}
                  className={`flex items-start gap-3 px-2 py-0.5 rounded-lg group hover:bg-surface-700/40 transition-colors ${
                    isOwn ? 'flex-row-reverse' : ''
                  }`}
                >
                  {!isGrouped ? (
                    <Avatar name={msg.senderName} />
                  ) : (
                    <div className="w-8 shrink-0 flex items-center justify-end">
                      <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatMsgTime(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {!isGrouped && (
                      <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <span className="text-sm font-semibold text-slate-200">{msg.senderName}</span>
                        <span className="text-[11px] text-slate-500">{formatMsgTime(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                      isOwn
                        ? 'bg-brand/20 text-slate-100 rounded-br-sm'
                        : 'bg-surface-700 text-slate-100 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {channelTypers.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-1 animate-fade-in">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {channelTypers.map((u) => u.userName).join(', ')}{' '}
            {channelTypers.length === 1 ? 'is' : 'are'} typing…
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
