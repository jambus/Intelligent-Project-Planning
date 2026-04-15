import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';
import '../index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="resources" element={<Resources />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </StrictMode>
  );
}
