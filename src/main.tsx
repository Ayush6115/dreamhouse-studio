import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useDesignStore } from './store/designStore';
import { loadMostRecent, migrateLegacy, startAutosave } from './store/persistence';

// Upgrade V1 storage, restore the most recent project, then keep autosaving.
migrateLegacy();
const saved = loadMostRecent();
if (saved) useDesignStore.getState().loadDocument(saved);
startAutosave();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
