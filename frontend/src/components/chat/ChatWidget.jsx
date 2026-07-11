import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../../context/AuthContext'
import { getAccessToken } from '../../api/client'

const GUEST_TOKEN_KEY = 'gm_chat_guest_token'
const GUEST_NAME_KEY = 'gm_chat_guest_name'

function getOrCreateGuestToken() {
  let t = localStorage.getItem(GUEST_TOKEN_KEY)
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(GUEST_TOKEN_KEY, t) }
  return t
}

function isImageMsg(content) { return content?.startsWith('IMAGE::') }
function imageUrl(content) { return content?.replace('IMAGE::', '') }

function ChatBubble({ msg, isUser }) {
  const isImg = isImageMsg(msg.content)
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl text-sm overflow-hidden ${
        isUser ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'
      } ${isImg ? 'p-1' : 'px-3 py-2'}`}>
        {!isUser && !isImg && (
          <p className="mb-0.5 text-[10px] font-semibold text-violet-400">Support</p>
        )}
        {isImg ? (
          <a href={imageUrl(msg.content)} target="_blank" rel="noopener noreferrer">
            <img
              src={imageUrl(msg.content)}
              alt="shared"
              className="max-w-full rounded-xl"
              style={{ maxHeight: 200 }}
            />
          </a>
        ) : (
          <p className="leading-relaxed break-words">{msg.content}</p>
        )}
        <p className={`mt-1 text-[10px] ${isImg ? 'px-2 pb-1' : ''} ${isUser ? 'text-violet-300' : 'text-slate-500'}`}>
          {new Date(msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export default function ChatWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [guestName, setGuestName] = useState(localStorage.getItem(GUEST_NAME_KEY) || '')
  const [nameSubmitted, setNameSubmitted] = useState(!!localStorage.getItem(GUEST_NAME_KEY))
  const [closed, setClosed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null) // { file, localUrl }
  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const sessionIdRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  const initSocket = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('chat_ready', ({ session_id, messages: msgs }) => {
      setSessionId(session_id); setMessages(msgs); setClosed(false)
    })
    socket.on('new_message', (msg) => {
      if (msg.session_id === sessionIdRef.current) setMessages(prev => [...prev, msg])
    })
    socket.on('session_closed', () => setClosed(true))
    return socket
  }, [])

  const joinChat = useCallback((socket, name) => {
    const token = getAccessToken()
    const guest_token = user ? null : getOrCreateGuestToken()
    const guest_name = user ? null : (name || guestName || 'Guest')
    socket.emit('join_chat', { token, guest_token, guest_name })
  }, [user, guestName])

  useEffect(() => {
    if (!open) return
    const socket = initSocket()
    if (nameSubmitted || user) joinChat(socket)
    return () => { socket?.disconnect(); socketRef.current = null }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const sendMessage = (e) => {
    e?.preventDefault()
    const content = input.trim()
    if (!content || !sessionId || closed) return
    socketRef.current?.emit('user_message', { session_id: sessionId, content, token: getAccessToken() })
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
    if (!imagePreview || !sessionId || closed) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', imagePreview.file)
      const res = await fetch('/api/v1/chat/upload-image', { method: 'POST', body: fd })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      socketRef.current?.emit('user_message', {
        session_id: sessionId,
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

  const handleNameSubmit = (e) => {
    e.preventDefault()
    const name = guestName.trim() || 'Guest'
    setGuestName(name)
    localStorage.setItem(GUEST_NAME_KEY, name)
    setNameSubmitted(true)
    joinChat(socketRef.current || initSocket(), name)
  }

  const handleClose = () => {
    if (sessionId) socketRef.current?.emit('close_session', { session_id: sessionId, token: getAccessToken() })
    setOpen(false)
    socketRef.current?.disconnect()
    socketRef.current = null
    setMessages([]); setSessionId(null); setClosed(false); cancelImage()
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 shadow-lg shadow-violet-900/40 hover:bg-violet-500 transition-all duration-200 hover:scale-105"
        aria-label="Live chat"
      >
        {open ? (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden"
          style={{ height: imagePreview ? '460px' : '420px' }}>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-sm font-semibold text-slate-100">Support Chat</span>
            </div>
            <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition text-xs">
              End chat
            </button>
          </div>

          {/* Guest name prompt */}
          {!user && !nameSubmitted ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-200">Welcome!</p>
                <p className="mt-1 text-xs text-slate-500">Enter your name to start chatting with support.</p>
              </div>
              <form onSubmit={handleNameSubmit} className="w-full space-y-3">
                <input
                  autoFocus
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
                />
                <button type="submit"
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
                  Start Chat
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Send a message or image — our team will reply shortly.
                  </div>
                )}
                {messages.map(msg => (
                  <ChatBubble key={msg.id} msg={msg} isUser={msg.sender === 'user'} />
                ))}
                {closed && (
                  <p className="text-center text-xs text-slate-500 py-2">This session has been closed.</p>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Image preview strip */}
              {imagePreview && (
                <div className="border-t border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center gap-3">
                  <img src={imagePreview.localUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-slate-700" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 truncate">{imagePreview.file.name}</p>
                    <p className="text-[10px] text-slate-600">{(imagePreview.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={sendImage} disabled={uploading || !connected || !sessionId}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-40">
                      {uploading ? '…' : 'Send'}
                    </button>
                    <button onClick={cancelImage} className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              {!closed && (
                <form onSubmit={sendMessage} className="border-t border-slate-800 flex items-center gap-2 p-3">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageSelect}
                  />
                  {/* Image button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!connected || !sessionId || !!imagePreview}
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
                    placeholder="Type a message…"
                    disabled={!connected || !sessionId}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                  <button type="submit" disabled={!connected || !sessionId || !input.trim()}
                    className="flex-shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-white hover:bg-violet-500 transition disabled:opacity-40">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
