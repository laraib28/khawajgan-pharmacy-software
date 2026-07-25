'use client';

import { useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type MicState = 'idle' | 'recording' | 'processing';

interface Message {
  id: number;
  role: Role;
  text: string;
  audioBase64?: string;
}

const SUGGESTIONS = [
  "What are today's total sales?",
  "Which medicines are low on stock?",
  "Show me this month's profit summary",
  "What are the top 5 selling medicines?",
];

let msgId = 0;

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMessage = (role: Role, text: string, audioBase64?: string) => {
    setMessages(m => [...m, { id: msgId++, role, text, audioBase64 }]);
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.play().catch(() => {});
  };

  const sendText = async (text: string) => {
    if (!text.trim() || isTyping) return;
    setError('');
    setInput('');
    addMessage('user', text.trim());
    setIsTyping(true);

    try {
      const res = await fetch('/api/chatbot/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Request failed');
      addMessage('assistant', data.response, data.audio_base64);
      playAudio(data.audio_base64);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsTyping(false);
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
      setError('Microphone access denied. Allow mic permissions and try again.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setMicState('processing');
  };

  const sendVoice = async (blob: Blob) => {
    setIsTyping(true);
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');

    try {
      const res = await fetch('/api/chatbot/voice', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Request failed');
      addMessage('user', data.transcript);
      addMessage('assistant', data.response, data.audio_base64);
      playAudio(data.audio_base64);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Voice processing failed');
    } finally {
      setMicState('idle');
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  };

  const handleMic = () => {
    if (micState === 'idle') startRecording();
    else if (micState === 'recording') stopRecording();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', background: '#f9fafb' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
          🤖
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Pharmacy Assistant</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Ask about sales, profit, inventory, account balances</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Empty state */}
          {messages.length === 0 && !isTyping && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', paddingTop: '40px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤖</div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                  How can I help you today?
                </h2>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  Ask me anything about your pharmacy business
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendText(s)}
                    style={{
                      padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: '12px', fontSize: '13px', color: '#374151', cursor: 'pointer',
                      textAlign: 'left', lineHeight: 1.5,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e40af'; (e.currentTarget as HTMLElement).style.background = '#f0f4ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? '#1e40af' : 'linear-gradient(135deg, #1e40af, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 700, color: '#fff',
              }}>
                {msg.role === 'user' ? 'U' : '🤖'}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                background: msg.role === 'user' ? '#1e40af' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#111827',
                fontSize: '14px', lineHeight: 1.6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
                {msg.role === 'assistant' && msg.audioBase64 && (
                  <button
                    onClick={() => playAudio(msg.audioBase64!)}
                    style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9ca3af', padding: 0 }}
                  >
                    🔊 Play again
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🤖</div>
              <div style={{ padding: '14px 18px', background: '#fff', borderRadius: '4px 18px 18px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: '7px', height: '7px', borderRadius: '50%', background: '#9ca3af',
                    animation: 'bounce 1.2s infinite',
                    animationDelay: `${i * 0.2}s`,
                    display: 'inline-block',
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div style={{ background: '#fef2f2', borderTop: '1px solid #fecaca', padding: '10px 24px', fontSize: '13px', color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          {/* Mic button */}
          <button
            onClick={handleMic}
            disabled={isTyping}
            aria-label={micState === 'recording' ? 'Stop recording' : 'Start voice input'}
            style={{
              width: '44px', height: '44px', borderRadius: '12px', border: 'none', cursor: isTyping ? 'default' : 'pointer',
              background: micState === 'recording' ? '#dc2626' : micState === 'processing' ? '#7c3aed' : '#f3f4f6',
              color: micState !== 'idle' ? '#fff' : '#6b7280',
              fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s',
              boxShadow: micState === 'recording' ? '0 0 0 4px #dc262633' : 'none',
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
              placeholder={micState === 'recording' ? 'Recording… press ⏹ to stop' : 'Type a message or use the mic…'}
              rows={1}
              disabled={micState === 'recording' || micState === 'processing' || isTyping}
              style={{
                width: '100%', resize: 'none', border: '1px solid #e5e7eb',
                borderRadius: '12px', padding: '11px 48px 11px 14px',
                fontSize: '14px', lineHeight: 1.5, outline: 'none',
                background: micState !== 'idle' ? '#f9fafb' : '#fff',
                color: '#111827', boxSizing: 'border-box',
                fontFamily: 'inherit', maxHeight: '120px', overflowY: 'auto',
              }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            {/* Send button inside input */}
            <button
              onClick={() => sendText(input)}
              disabled={!input.trim() || isTyping || micState !== 'idle'}
              style={{
                position: 'absolute', right: '8px', bottom: '8px',
                width: '30px', height: '30px', borderRadius: '8px', border: 'none',
                background: input.trim() && !isTyping && micState === 'idle' ? '#1e40af' : '#e5e7eb',
                color: input.trim() && !isTyping && micState === 'idle' ? '#fff' : '#9ca3af',
                cursor: input.trim() && !isTyping && micState === 'idle' ? 'pointer' : 'default',
                fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              ↑
            </button>
          </div>
        </div>
        <div style={{ maxWidth: '720px', margin: '6px auto 0', fontSize: '11px', color: '#d1d5db', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line · Mic for voice input
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
