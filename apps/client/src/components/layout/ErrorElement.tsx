import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';

export function ErrorElement() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
      <h2 style={{ color: 'var(--vv-navy)', margin: '0 0 8px' }}>Something went wrong</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 20px', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-primary" onClick={() => window.location.reload()}>Try Again</button>
        <button className="btn-secondary" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    </div>
  );
}
