'use client';

import { useRef, useState } from 'react';

type PipelineState = 'idle' | 'recording' | 'processing' | 'playing' | 'error';

interface Exchange { transcript: string; response: string; }

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PipelineState>('idle');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        sendAudio(new Blob(chunksRef.current, { type: mr.mimeType }));
      };
      mr.start();
      recorderRef.current = mr;
      setState('recording');
    } catch {
      setError('Microphone access denied. Allow mic permissions and try again.');
      setState('error');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setState('processing');
  };

  const sendAudio = async (blob: Blob) => {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    try {
      const res = await fetch('/api/chatbot/voice', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(body.detail ?? 'Request failed');
      }
      const data = await res.json() as { transcript: string; response: string; audio_base64: string };
      setHistory(h => [...h, { transcript: data.transcript, response: data.response }]);
      scrollToBottom();

      const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
      setState('playing');
      audio.onended = () => setState('idle');
      audio.onerror = () => setState('idle');
      audio.play().catch(() => setState('idle'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  const handleMicClick = () => {
    if (state === 'idle' || state === 'error') startRecording();
    else if (state === 'recording') stopRecording();
  };

  const btnColor = { idle: '#1e40af', recording: '#dc2626', processing: '#7c3aed', playing: '#059669', error: '#dc2626' }[state];
  const micIcon = { idle: '🎤', recording: '⏹', processing: '⏳', playing: '🔊', error: '🎤' }[state];
  const stateLabel = {
    idle: 'Tap to speak',
    recording: 'Recording — tap to stop',
    processing: 'Processing…',
    playing: 'Playing response…',
    error: 'Tap to try again',
  }[state];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Voice Assistant"
        aria-label="Open voice assistant"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
          width: '50px', height: '50px', borderRadius: '50%',
          background: open ? '#0f172a' : '#1e40af',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
          fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '82px', right: '24px', zIndex: 200,
          width: '320px', background: '#fff', borderRadius: '14px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Pharmacy Assistant</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
              Ask about sales, profit, inventory…
            </div>
          </div>

          {/* Conversation */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', minHeight: '100px' }}
          >
            {history.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', paddingTop: '16px', lineHeight: 1.6 }}>
                Speak a question like<br />
                <span style={{ color: '#475569', fontStyle: 'italic' }}>"What are today&apos;s sales?"</span><br />
                <span style={{ color: '#475569', fontStyle: 'italic' }}>"Which medicines are low on stock?"</span>
              </div>
            ) : (
              history.map((ex, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ background: '#f1f5f9', borderRadius: '10px 10px 10px 2px', padding: '8px 11px', fontSize: '12px', color: '#475569' }}>
                    <span style={{ fontWeight: 700, fontSize: '10px', display: 'block', marginBottom: '3px', color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>You</span>
                    {ex.transcript}
                  </div>
                  <div style={{ background: '#dbeafe', borderRadius: '2px 10px 10px 10px', padding: '8px 11px', fontSize: '12px', color: '#1e3a8a' }}>
                    <span style={{ fontWeight: 700, fontSize: '10px', display: 'block', marginBottom: '3px', color: '#3b82f6', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Assistant</span>
                    {ex.response}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '8px 14px', background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: '11px', color: '#dc2626', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {/* Mic controls */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', background: '#fafafa' }}>
            <button
              onClick={handleMicClick}
              disabled={state === 'processing' || state === 'playing'}
              aria-label={stateLabel}
              style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: btnColor, border: 'none',
                cursor: state === 'processing' || state === 'playing' ? 'default' : 'pointer',
                fontSize: '22px',
                boxShadow: state === 'recording' ? `0 0 0 6px ${btnColor}33, 0 0 0 12px ${btnColor}15` : '0 2px 8px rgba(0,0,0,0.12)',
                transition: 'background 0.2s, box-shadow 0.2s',
                opacity: state === 'processing' || state === 'playing' ? 0.7 : 1,
              }}
            >
              {micIcon}
            </button>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{stateLabel}</div>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                style={{ fontSize: '10px', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
              >
                Clear history
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
