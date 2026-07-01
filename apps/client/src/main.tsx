import i18n from './i18n'; // FIRST — initializes the i18next singleton before render
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { showToast } from '@org/data';

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
  showToast(i18n.t('toast:unexpectedError', 'An unexpected error occurred.'), 'error');
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
