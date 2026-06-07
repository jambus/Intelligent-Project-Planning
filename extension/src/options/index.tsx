import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { DashboardOverview } from './pages/dashboard/DashboardOverview';
import { TeamCapacity } from './pages/dashboard/TeamCapacity';
import { ProjectResults } from './pages/dashboard/ProjectResults';
import { ScheduleDetails } from './pages/dashboard/ScheduleDetails';
import { Projects } from './pages/Projects';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';
import { Holidays } from './pages/Holidays';
import { Skills } from './pages/Skills';
import { ScrumTeams } from './pages/ScrumTeams';
import { ProductOps } from './pages/ProductOps';
import { JiraSync } from './pages/JiraSync';
import { SchedulingProvider } from '../context/SchedulingContext';
import { DashboardProvider } from '../context/DashboardContext';
import { I18nProvider } from '../context/I18nContext';
import '../index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <I18nProvider>
        <SchedulingProvider>
          <DashboardProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<DashboardOverview />} />
                  <Route path="team-capacity" element={<TeamCapacity />} />
                  <Route path="project-results" element={<ProjectResults />} />
                  <Route path="schedule-details" element={<ScheduleDetails />} />
                  
                  <Route path="projects" element={<Projects />} />
                  <Route path="jira-sync" element={<JiraSync />} />
                  <Route path="resources" element={<Resources />} />
                  <Route path="scrum" element={<ScrumTeams />} />
                  <Route path="skills" element={<Skills />} />
                  <Route path="product-ops" element={<ProductOps />} />
                  <Route path="holidays" element={<Holidays />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </HashRouter>
          </DashboardProvider>
        </SchedulingProvider>
      </I18nProvider>
    </StrictMode>
  );
}
