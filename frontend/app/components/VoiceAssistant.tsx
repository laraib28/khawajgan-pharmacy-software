'use client';

import { useRef, useState } from 'react';

type MicState = 'idle' | 'recording' | 'processing';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  audioBase64?: string;
}

let msgId = 0;

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);

  const addMsg = (role: 'user' | 'assistant', text: string, audioBase64?: string) => {
    setMessages(m => [...m, { id: msgId++, role, text, audioBase64 }]);
    scrollToBottom();
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.play().catch(() => {});
  };

  const sendText = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError('');
    setInput('');
    addMsg('user', text.trim());
    setIsLoading(true);
    try {
      const res = await fetch('/api/chatbot/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Request failed');
      addMsg('assistant', data.response, data.audio_base64);
      playAudio(data.audio_base64);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        sendVoice(new Blob(chunksRef.current, { type: mr.mimeType }));
      };
      mr.start();
      recorderRef.current = mr;
      setMicState('recording');
    } catch {
      setError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setMicState('processing');
  };

  const sendVoice = async (blob: Blob) => {
    setIsLoading(true);
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    try {
      const res = await fetch('/api/chatbot/voice', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Request failed');
      addMsg('user', data.transcript);
      addMsg('assistant', data.response, data.audio_base64);
      playAudio(data.audio_base64);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Voice processing failed');
    } finally {
      setMicState('idle');
      setIsLoading(false);
    }
  };

  const handleMic = () => {
    if (micState === 'idle' && !isLoading) startRecording();
    else if (micState === 'recording') stopRecording();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  };

  const busy = isLoading || micState !== 'idle';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Pharmacy Assistant"
        aria-label="Open assistant"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
          width: '52px', height: '52px', borderRadius: '50%',
          background: open ? '#0f172a' : '#1e40af',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '86px', right: '24px', zIndex: 200,
          width: '340px', background: '#fff', borderRadius: '16px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          maxHeight: '520px',
        }}>

          {/* Header */}
          <div style={{ padding: '12px 16px', background: '#1e40af', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px' }}>🤖</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Pharmacy Assistant</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe' }}>Ask about sales, stock, profit…</div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '11px' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}
          >
            {messages.length === 0 && !isLoading && (
              <div style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center', paddingTop: '20px', lineHeight: 1.8 }}>
                Type or speak a question:<br />
                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>"Today&apos;s sales?"</span><br />
                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>"Low stock medicines?"</span>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: '6px', alignItems: 'flex-end',
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 11px',
                  borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? '#1e40af' : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: '12px', lineHeight: 1.5,
                }}>
                  {msg.text}
                  {msg.role === 'assistant' && msg.audioBase64 && (
                    <button
                      onClick={() => playAudio(msg.audioBase64!)}
                      style={{ display: 'block', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#64748b', padding: 0 }}
                    >
                      🔊 Play
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingLeft: '4px' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8',
                    display: 'inline-block',
                    animation: 'va-bounce 1.2s infinite',
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '6px 12px', background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: '11px', color: '#dc2626', display: 'flex', justifyContent: 'space-between' }}>
              <span>{error}</span>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>×</button>
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'flex-end', background: '#f8fafc' }}>
            {/* Mic */}
            <button
              onClick={handleMic}
              disabled={isLoading && micState === 'idle'}
              aria-label={micState === 'recording' ? 'Stop' : 'Record'}
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none', flexShrink: 0,
                background: micState === 'recording' ? '#dc2626' : micState === 'processing' ? '#7c3aed' : '#e2e8f0',
                color: micState !== 'idle' ? '#fff' : '#64748b',
                cursor: busy && micState === 'idle' ? 'default' : 'pointer',
                fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: micState === 'recording' ? '0 0 0 4px #dc262633' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {micState === 'idle' && '🎤'}
              {micState === 'recording' && '⏹'}
              {micState === 'processing' && '⏳'}
            </button>

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={micState === 'recording' ? 'Recording…' : 'Type a message…'}
                rows={1}
                disabled={micState !== 'idle' || isLoading}
                style={{
                  width: '100%', resize: 'none', border: '1px solid #e2e8f0',
                  borderRadius: '10px', padding: '8px 36px 8px 10px',
                  fontSize: '12px', lineHeight: 1.5, outline: 'none',
                  background: busy ? '#f1f5f9' : '#fff',
                  color: '#1e293b', boxSizing: 'border-box',
                  fontFamily: 'inherit', maxHeight: '80px', overflowY: 'auto',
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 80) + 'px';
                }}
              />
              <button
                onClick={() => sendText(input)}
                disabled={!input.trim() || busy}
                style={{
                  position: 'absolute', right: '6px', bottom: '6px',
                  width: '24px', height: '24px', borderRadius: '6px', border: 'none',
                  background: input.trim() && !busy ? '#1e40af' : '#e2e8f0',
                  color: input.trim() && !busy ? '#fff' : '#94a3b8',
                  cursor: input.trim() && !busy ? 'pointer' : 'default',
                  fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes va-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
