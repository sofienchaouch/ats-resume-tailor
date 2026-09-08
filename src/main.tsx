import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './AuthContext.tsx';
import { ToastProvider } from './components/Toast.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { TailorQueueProvider } from './components/tailorQueue/TailorQueueContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          {/* Above <App /> so the queue survives navigating to the landing view,
              which early-returns before App's main tree. */}
          <TailorQueueProvider>
            <App />
          </TailorQueueProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
