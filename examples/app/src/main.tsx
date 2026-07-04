import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { App } from './App';
import './tailwind.css';

// styled-components theme — the `Ghost` button reads `p.theme.text`.
const theme = { text: '#111827' };

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <App theme="light" />
    </ThemeProvider>
  </StrictMode>,
);
