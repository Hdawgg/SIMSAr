import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/style.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import { ToastProvider } from './context/ToastContext';
import { DEMO_LABEL, DEMO_ROLE } from './demo';

// In `npm run dev:demo`, prefix the tab title so the three tabs are easy to tell apart.
if (DEMO_ROLE) document.title = `[${DEMO_LABEL}] ${document.title}`;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfigProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfigProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
