interface StatsCardProps {
  label: string;
  value: number | string;
  className?: string;
}

export default function StatsCard({ label, value, className }: StatsCardProps) {
  return (
    <div className={className} style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '20px 24px',
      minWidth: '160px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e40af' }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{label}</div>
    </div>
  );
}
