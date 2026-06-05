export type ToastType = 'info' | 'success' | 'warning' | 'error';

let _container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (_container) return _container;
  _container = document.createElement('div');
  _container.id = 'toast-container';
  document.body.appendChild(_container);
  return _container;
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration = 3500,
  onRetry?: () => void
) {
  const container = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);

  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'toast-retry';
    btn.textContent = 'Retry';
    btn.addEventListener('click', () => { toast.remove(); onRetry(); });
    toast.appendChild(btn);
    duration = Math.max(duration, 6000);
  }

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}
