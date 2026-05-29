import React, { useState } from 'react';
import { Users, Copy, Check, Wifi, WifiOff, Send } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useSocket } from '../hooks/useSocket';

export function RoomPanel() {
  const roomCode = useSessionStore(s => s.roomCode);
  const users = useSessionStore(s => s.users);
  const isOperator = useSessionStore(s => s.isOperator);
  const connected = useSessionStore(s => s.connected);
  const { sendAnnouncement } = useSocket();
  const [copied, setCopied] = useState(false);
  const [annText, setAnnText] = useState('');
  const [sending, setSending] = useState(false);

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyUrl = () => {
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 text-sm">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        {connected
          ? <Wifi className="w-4 h-4 text-green-400" />
          : <WifiOff className="w-4 h-4 text-red-400" />}
        <span className={connected ? 'text-green-400' : 'text-red-400'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Room code */}
      {roomCode && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Room</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-widest">{roomCode}</span>
            <button onClick={copyCode} className="text-gray-500 hover:text-gray-300 transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={copyUrl}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            Copy join link
          </button>
        </div>
      )}

      {/* Users */}
      {users.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {users.length} {users.length === 1 ? 'person' : 'people'}
          </p>
          <ul className="space-y-1">
            {users.map(u => (
              <li key={u.id} className="flex items-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full ${u.role === 'operator' ? 'bg-blue-400' : 'bg-gray-500'}`} />
                <span className="text-gray-300">{u.name}</span>
                <span className="text-gray-600">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Announcement */}
      {isOperator && (
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Announcement</p>
          <div className="flex gap-2">
            <textarea
              value={annText}
              onChange={e => setAnnText(e.target.value.slice(0, 280))}
              placeholder="Send a message to all viewers..."
              rows={2}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5
                text-xs text-gray-200 placeholder-gray-600 resize-none
                focus:outline-none focus:border-amber-600"
            />
            <button
              onClick={handleSendAnn}
              disabled={!annText.trim() || sending}
              className="self-end px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600
                disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-600 text-right">{annText.length}/280</p>
        </div>
      )}
    </div>
  );
}
