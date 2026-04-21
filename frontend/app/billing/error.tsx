'use client';

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ color: '#dc2626', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
        Error in Billing Page
      </h2>
      <pre style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '13px',
        color: '#dc2626',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        marginBottom: '16px',
      }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{ padding: '8px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        Try Again
      </button>
    </div>
  );
}
