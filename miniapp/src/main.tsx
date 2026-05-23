import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { applyTelegramTheme, tg } from './telegram';

// Initialise Telegram Web App
tg?.ready();
tg?.expand();
applyTelegramTheme();

// Re-apply theme if it changes (e.g. user switches dark mode)
tg?.onEvent('themeChanged', applyTelegramTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
