import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TenantAuthProvider } from './contexts/TenantAuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantAuthProvider>
      <App />
    </TenantAuthProvider>
  </StrictMode>,
);
