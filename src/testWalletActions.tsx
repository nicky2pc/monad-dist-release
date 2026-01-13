import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.test.tsx';
import { Providers } from './providers/Provider.tsx';
import LoginBtn from './components/LoginBtn/LoginBtn.tsx';

const root = ReactDOM.createRoot(
  document.getElementById('test-root') as HTMLElement
);
root.render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);

