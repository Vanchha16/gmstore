import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import AdminLayout from './AdminLayout'
import { getAccessToken } from '../../api/client'

function timeAgo(iso) {
  const d = new Date(iso + 'Z')
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

function isImageMsg(content) { return content?.startsWith('IMAGE::') }
function imageUrl(content) { return content?.replace('IMAGE::', '') }

function MsgBubble({ msg, isAdmin }) {
  const isImg = isImageMsg(msg.content)
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] rounded-2xl text-sm overflow-hidden ${
        isAdmin
          ? 'bg-violet-600 text-white rounded-br-sm'
          : 'bg-slate-800 text-slate-200 rounded-bl-sm'
      } ${isImg ? 'p-1' : 'px-3 py-2'}`}>
        {!isAdmin && !isImg && (
          <p className="mb-0.5 text-[10px] font-semibold text-slate-400">{msg._displayName || 'User'}</p>
        )}
        {isImg ? (
          <a href={imageUrl(msg.content)} target="_blank" rel="noopener noreferrer">
            <img src={imageUrl(msg.content)} alt="shared" className="max-w-full rounded-xl" style={{ maxHeight: 220 }} />
          </a>
        ) : (
          <p className="leading-relaxed break-words">{msg.content}</p>
        )}
        <p className={`mt-1 text-[10px] ${isImg ? 'px-2 pb-1' : ''} ${isAdmin ? 'text-violet-300' : 'text-slate-500'}`}>
          {new Date(msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export default function AdminChat() {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [activeDisplayName, setActiveDisplayName] = useState('')
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('open')
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const socketRef = useRef(null)
  const activeIdRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_admin', { token: getAccessToken() })
    })
    socket.on('disconnect', () => setConnected(false))

    socket.on('active_sessions', (list) => setSessions(list))

    socket.on('new_session', (s) => {
      setSessions(prev => {
        const exists = prev.find(x => x.id === s.id)
        return exists ? prev : [s, ...prev]
      })
    })

    socket.on('session_notification', (s) => {
      setSessions(prev => {
        const exists = prev.find(x => x.id === s.id)
        if (!exists) return [s, ...prev]
        return prev.map(x => x.id === s.id ? { ...x, ...s } : x)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      })
    })

    socket.on('chat_history', ({ session_id, display_name, messages: msgs }) => {
      if (session_id === activeIdRef.current) {
        setMessages(msgs)
        setActiveDisplayName(display_name)
      }
    })

    socket.on('new_message', (msg) => {
      if (msg.session_id === activeIdRef.current) {
        setMessages(prev => [...prev, msg])
      }
    })

    socket.on('session_closed', ({ session_id }) => {
      setSessions(prev => prev.map(s =>
        s.id === session_id ? { ...s, status: 'closed' } : s
      ))
    })

    return () => socket.disconnect()
  }, [])

  const openSession = useCallback((session) => {
    if (activeIdRef.current === session.id) return
    // Leave old room
    if (activeIdRef.current) {
      socketRef.current?.emit('admin_leave_session', { session_id: activeIdRef.current })
    }
    setActiveId(session.id)
    setMessages([])
    setActiveDisplayName(session.display_name)
    socketRef.current?.emit('admin_open_session', {
      session_id: session.id,
      token: getAccessToken(),
    })
  }, [])

  const sendReply = (e) => {
    e?.preventDefault()
    const content = input.trim()
    if (!content || !activeId) return
    socketRef.current?.emit('admin_message', { session_id: activeId, content, token: getAccessToken() })
    setInput('')
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return }
    setImagePreview({ file, localUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const cancelImage = () => {
    if (imagePreview?.localUrl) URL.revokeObjectURL(imagePreview.localUrl)
    setImagePreview(null)
  }

  const sendImage = async () => {
    if (!imagePreview || !activeId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', imagePreview.file)
      const res = await fetch('/api/v1/chat/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: fd,
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      socketRef.current?.emit('admin_message', {
        session_id: activeId,
        content: `IMAGE::${url}`,
        token: getAccessToken(),
      })
      cancelImage()
    } catch (err) {
      alert(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const closeSession = (sessionId) => {
    if (!confirm('Close this chat session?')) return
    socketRef.current?.emit('close_session', {
      session_id: sessionId,
      token: getAccessToken(),
    })
    if (activeId === sessionId) {
      setActiveId(null)
      setMessages([])
    }
  }

  const filtered = sessions.filter(s => filter === 'all' || s.status === filter)
  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
          Live Chat Support
          <span className={`ml-3 inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        </h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none">
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="flex gap-0 rounded-2xl border border-slate-800 overflow-hidden" style={{ height: '540px' }}>
        {/* Session list */}
        <div className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-950/50">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {filtered.length} session{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-12 text-center text-xs text-slate-500">No {filter} sessions.</p>
            )}
            {filtered.map(s => (
              <button key={s.id} onClick={() => openSession(s)}
                className={`w-full text-left px-3 py-3 border-b border-slate-800/60 transition ${
                  activeId === s.id ? 'bg-violet-500/10 border-l-2 border-l-violet-500' : 'hover:bg-slate-900/60'
                }`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-200 truncate">{s.display_name}</span>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(s.updated_at)}</span>
                </div>
                {s.last_message && (
                  <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {s.last_sender === 'admin' ? '↩ ' : ''}{s.last_message}
                  </p>
                )}
                {s.status === 'closed' && (
                  <span className="mt-1 inline-block text-[9px] font-semibold uppercase text-slate-600">closed</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 flex flex-col">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
              Select a session to view the conversation
            </div>
          ) : (
            <>
              {/* Convo header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/30">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{activeDisplayName}</p>
                  <p className="text-[10px] text-slate-500">Session #{activeId}</p>
                </div>
                {activeSession?.status === 'open' && (
                  <button onClick={() => closeSession(activeId)}
                    className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 transition">
                    Close session
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-500">No messages yet.</p>
                )}
                {messages.map(msg => (
                  <MsgBubble
                    key={msg.id}
                    msg={{ ...msg, _displayName: activeDisplayName }}
                    isAdmin={msg.sender === 'admin'}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              {activeSession?.status === 'open' ? (
                <div className="border-t border-slate-800">
                  {/* Image preview strip */}
                  {imagePreview && (
                    <div className="flex items-center gap-3 bg-slate-950/60 px-3 py-2 border-b border-slate-800">
                      <img src={imagePreview.localUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover border border-slate-700" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 truncate">{imagePreview.file.name}</p>
                        <p className="text-[10px] text-slate-600">{(imagePreview.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button onClick={sendImage} disabled={uploading}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-40">
                        {uploading ? '…' : 'Send'}
                      </button>
                      <button onClick={cancelImage}
                        className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
                        ✕
                      </button>
                    </div>
                  )}

                  <form onSubmit={sendReply} className="flex items-center gap-2 p-3">
                    {/* Hidden file input */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!!imagePreview}
                      className="flex-shrink-0 rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-violet-400 hover:border-violet-500/50 transition disabled:opacity-40"
                      title="Send image"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a reply…"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
                    />
                    <button type="submit" disabled={!input.trim()}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-40">
                      Send
                    </button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500">
                  Session closed
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
