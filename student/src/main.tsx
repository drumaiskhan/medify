import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(<App />);

// Installable app + offline shell. Notes themselves are saved by the app, not the worker.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
