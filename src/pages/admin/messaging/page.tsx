import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/feature/AdminLayout';
import Toast, { useToast } from '@/components/base/Toast';
import { adminApi, tokenStore } from '@/lib/api';

type Conversation = {
  id: string;
  title?: string;
  participantNames?: string[];
  unreadCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  isSupport?: boolean;
  userId?: string;
};

type Message = {
  id: string;
  text?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
};

const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1' };

export default function AdminMessagingPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserId = tokenStore.user?.id ?? null;

  // ── Load conversations ──────────────────────────────────────────────
  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await adminApi.conversations({ limit: 100 });
      const items: Conversation[] = res.items || res.conversations || res.data || [];
      setConversations(items);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  // ── Load + poll messages ────────────────────────────────────────────
  const loadMessages = async (conv: Conversation, silent = false) => {
    if (!silent) { setSelected(conv); setLoadingMessages(true); }
    try {
      const res = await adminApi.conversationMessages(conv.id, { limit: 50 });
      setMessages(res.messages || []);
    } catch {
      if (!silent) addToast('error', 'Erreur', 'Impossible de charger les messages.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const openConversation = (conv: Conversation) => {
    setSelected(conv);
    loadMessages(conv);
    // Mark as read
    adminApi.sendMessage(conv.id, { text: undefined } as any).catch(() => {});
  };

  // Poll every 5s when a conversation is open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => loadMessages(selected, true), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!selected || !newMessage.trim()) return;
    const text = newMessage.trim();
    setNewMessage('');
    try {
      await adminApi.sendMessage(selected.id, { text });
      const res = await adminApi.conversationMessages(selected.id, { limit: 50 });
      setMessages(res.messages || []);
    } catch {
      addToast('error', 'Erreur', "Échec de l'envoi du message.");
    }
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.title || '').toLowerCase().includes(q) ||
      (c.participantNames || []).some(n => n.toLowerCase().includes(q));
  });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <AdminLayout breadcrumb={['WATSIM', 'Système', 'Messagerie']}>
      <Toast toasts={toasts} onRemove={removeToast} />

      <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="w-80 flex flex-col rounded-2xl overflow-hidden" style={cardStyle}>
          {/* Header */}
          <div className="p-4" style={{ borderBottom: '1px solid #E8F2F1' }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
              Conversations
            </h2>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F5FAF5', border: '1px solid #E8F2F1' }}>
              <i className="ri-search-line text-sm" style={{ color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1"
                style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#4DB049' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <i className="ri-chat-3-line text-3xl mb-2" style={{ color: '#D1E8D1' }} />
                <p className="text-sm" style={{ color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>Aucune conversation</p>
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className="w-full p-3 text-left transition-colors hover:bg-[#F5FAF5]"
                  style={{
                    borderBottom: '1px solid #F0F7F0',
                    background: selected?.id === c.id ? '#EBF5EB' : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: c.isSupport ? '#014945' : '#E6F4E6', color: c.isSupport ? '#fff' : '#014945' }}>
                      {c.isSupport ? <i className="ri-customer-service-2-line text-sm" /> : (c.title || c.participantNames?.[0] || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold truncate" style={{ color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' }}>
                          {c.title || c.participantNames?.join(', ') || 'Conversation'}
                        </span>
                        {(c.unreadCount ?? 0) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#4DB049', color: '#fff', fontWeight: 700 }}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                        {c.lastMessage || 'Aucun message'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Refresh */}
          <div className="p-3" style={{ borderTop: '1px solid #E8F2F1' }}>
            <button
              onClick={loadConversations}
              className="w-full py-2 rounded-lg text-sm font-medium"
              style={{ background: '#F5FAF5', color: '#014945', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' }}
            >
              <i className="ri-refresh-line mr-1" /> Actualiser
            </button>
          </div>
        </div>

        {/* ── Chat panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={cardStyle}>
          {selected ? (
            <>
              {/* Chat header */}
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E8F2F1', background: '#F5FAF5' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: selected.isSupport ? '#014945' : '#E6F4E6', color: selected.isSupport ? '#fff' : '#014945' }}>
                  {selected.isSupport ? <i className="ri-customer-service-2-line" /> : (selected.title || selected.participantNames?.[0] || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>
                    {selected.title || selected.participantNames?.join(', ') || 'Conversation'}
                  </h3>
                  {selected.participantNames && (
                    <p className="text-xs truncate" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                      {selected.participantNames.join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E6F4E6', color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>
                  {selected.isSupport ? 'Support' : 'Direct'}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ background: '#FAFEF9' }}>
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#4DB049' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <i className="ri-chat-smile-2-line text-4xl mb-2" style={{ color: '#D1E8D1' }} />
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun message dans cette conversation.</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.senderId === currentUserId;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[70%] px-4 py-2.5 rounded-2xl"
                          style={{
                            background: isMe ? '#014945' : '#FFFFFF',
                            color: isMe ? '#FFFFFF' : '#1A2B1F',
                            border: isMe ? 'none' : '1px solid #E8F2F1',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                        >
                          {!isMe && m.senderName && (
                            <p className="text-xs font-semibold mb-1" style={{ color: '#4DB049', fontFamily: 'Poppins, sans-serif' }}>{m.senderName}</p>
                          )}
                          <p className="text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{m.text}</p>
                          <p className="text-[10px] mt-1 text-right" style={{ color: isMe ? 'rgba(255,255,255,0.6)' : '#9CA3AF', fontFamily: 'Poppins, sans-serif' }}>
                            {fmtTime(m.createdAt)}
                            {isMe && <i className="ri-check-double-line ml-1" style={{ color: '#86efac' }} />}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 flex gap-3 items-end" style={{ borderTop: '1px solid #E8F2F1', background: '#FFFFFF' }}>
                <div className="flex-1 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E8F2F1' }}>
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Taper votre message..."
                    className="w-full px-4 py-3 text-sm outline-none resize-none"
                    style={{ color: '#1A2B1F', background: 'transparent', fontFamily: 'Poppins, sans-serif', minHeight: '44px', maxHeight: '120px' }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                  style={{ background: '#014945', color: '#FFFFFF' }}
                >
                  <i className="ri-send-plane-2-fill text-lg" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: '#FAFEF9' }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#E6F4E6' }}>
                <i className="ri-message-3-line text-4xl" style={{ color: '#4DB049' }} />
              </div>
              <p className="text-base font-semibold" style={{ color: '#014945', fontFamily: 'Montserrat, sans-serif' }}>Messagerie Admin</p>
              <p className="text-sm text-center max-w-xs" style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>
                Sélectionnez une conversation pour afficher et répondre aux messages des utilisateurs.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
