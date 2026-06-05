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
    <div className="card max-w-[560px] mx-auto mt-10 text-center">
      <div className="text-[2.5rem] mb-3">⚠️</div>
      <h2 className="text-[#0B2A4A] mt-0 mb-2">Something went wrong</h2>
      <p className="text-[#64748b] text-[0.9rem] mt-0 mb-5 leading-relaxed">{message}</p>
      <div className="flex gap-2.5 justify-center">
        <button className="btn-primary" onClick={() => window.location.reload()}>Try Again</button>
        <button className="btn-secondary" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    </div>
  );
}
