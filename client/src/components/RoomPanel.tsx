import React, { useState } from 'react';
import { Users, Copy, Check, Send, ShieldCheck, ShieldOff, UserCircle } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useSocket } from '../hooks/useSocket';
import { cn } from '../utils/timeUtils';

export function RoomPanel() {
  const roomCode    = useSessionStore(s => s.roomCode);
  const roomOwnerId = useSessionStore(s => s.roomOwnerId);
  const users       = useSessionStore(s => s.users);
  const isOperator  = useSessionStore(s => s.isOperator);
  const currentUser = useSessionStore(s => s.user);
  const { sendAnnouncement, setUserRole } = useSocket();

  const [copied, setCopied]   = useState(false);
  const [annText, setAnnText] = useState('');
  const [sending, setSending] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendAnn = () => {
    if (!annText.trim()) return;
    setSending(true);
    sendAnnouncement(annText.trim());
    setAnnText('');
    setTimeout(() => setSending(false), 500);
  };

  const promoteUser = (socketId: string) => setUserRole(socketId, 'operator');
  const demoteUser  = (socketId: string) => setUserRole(socketId, 'viewer');

  return (
    <div className="space-y-4 text-sm">

      {/* ── Room code + share ───────────────────────────────────────────── */}
      {roomCode && (
        <div className="bg-warm-900/60 border border-warm-800/40 rounded-xl p-4 space-y-2">
          <p className="text-[10px] text-warm-600 uppercase tracking-wider">Room code</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-2xl font-bold text-warm-100 tracking-[0.2em]">
              {roomCode}
            </span>
            <button onClick={copyUrl}
              className="flex items-center gap-1.5 text-xs text-warm-600 hover:text-warm-300
                px-2 py-1 rounded hover:bg-warm-800/60 transition-colors">
              {copied
                ? <><Check className="w-3.5 h-3.5 text-moss-400" /> Copied</>
                : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
            </button>
          </div>
        </div>
      )}

      {/* ── People in the room ─────────────────────────────────────────── */}
      <div className="bg-warm-900/60 border border-warm-800/40 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-warm-600" />
          <p className="text-[10px] text-warm-600 uppercase tracking-wider">
            {users.length} {users.length === 1 ? 'person' : 'people'}
          </p>
        </div>

        <ul className="space-y-1.5">
          {users.map(u => {
            const isMe       = u.id === currentUser?.id;
            const isRegistered = !!u.userId;
            const isOp       = u.role === 'operator';
            const isOwner    = !!u.userId && u.userId === roomOwnerId;

            return (
              <li key={u.id}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs',
                  isMe ? 'bg-warm-800/60' : 'hover:bg-warm-800/30 transition-colors'
                )}>

                {/* Role dot */}
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  isOp ? 'bg-crimson-500' : 'bg-warm-700'
                )} />

                {/* Name */}
                <span className={cn('flex-1 truncate', isOp ? 'text-warm-200' : 'text-warm-500')}>
                  {u.name}
                  {isMe && <span className="text-warm-700 ml-1">(you)</span>}
                </span>

                {/* Registered badge */}
                {isRegistered
                  ? <span title="Registered user"><UserCircle className="w-3 h-3 text-warm-600 flex-shrink-0" /></span>
                  : <span className="text-[9px] text-warm-800 flex-shrink-0">guest</span>}

                {/* Role badge */}
                <span className={cn(
                  'text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0',
                  isOp
                    ? 'text-crimson-300 bg-crimson-900/40 border-crimson-800/50'
                    : 'text-warm-700 bg-warm-800/40 border-warm-800/40'
                )}>
                  {isOp ? 'op' : 'viewer'}
                </span>

                {/* Promote / demote — only operators can do this; can't change own role */}
                {isOperator && !isMe && (
                  isOp ? (
                    isOwner ? (
                      <span className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <button onClick={() => demoteUser(u.id)}
                        title="Remove operator"
                        className="text-warm-700 hover:text-amber-400 transition-colors flex-shrink-0">
                        <ShieldOff className="w-3.5 h-3.5" />
                      </button>
                    )
                  ) : isRegistered ? (
                    <button onClick={() => promoteUser(u.id)}
                      title="Make operator"
                      className="text-warm-700 hover:text-crimson-400 transition-colors flex-shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[9px] text-warm-800 flex-shrink-0" title="Must sign in to be promoted">
                      no acct
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>

        {isOperator && (
          <p className="text-[10px] text-warm-700 pt-1 border-t border-warm-800/40">
            <ShieldCheck className="w-3 h-3 inline mr-1 text-warm-800" />
            Viewers must be signed in to a SheetToTimer account to be promoted
          </p>
        )}
      </div>

      {/* ── Announcement ───────────────────────────────────────────────── */}
      {isOperator && (
        <div className="bg-warm-900/60 border border-warm-800/40 rounded-xl p-4 space-y-2">
          <p className="text-[10px] text-warm-600 uppercase tracking-wider">Announcement</p>
          <div className="flex gap-2">
            <textarea
              value={annText}
              onChange={e => setAnnText(e.target.value.slice(0, 280))}
              placeholder="Send a message to all viewers…"
              rows={2}
              className="flex-1 bg-warm-800/60 border border-warm-700/50 rounded-lg px-2.5 py-1.5
                text-xs text-warm-200 placeholder-warm-700 resize-none
                focus:outline-none focus:border-amber-600/60 transition-colors"
            />
            <button onClick={handleSendAnn} disabled={!annText.trim() || sending}
              className="self-end px-2.5 py-1.5 bg-amber-800/60 hover:bg-amber-700/60
                disabled:opacity-40 disabled:cursor-not-allowed border border-amber-700/50
                rounded-lg transition-colors">
              <Send className="w-3.5 h-3.5 text-amber-200" />
            </button>
          </div>
          <p className="text-[10px] text-warm-700 text-right">{annText.length}/280</p>
        </div>
      )}
    </div>
  );
}
