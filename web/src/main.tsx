import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { RepositoryProvider } from './data/RepositoryProvider';
import { OnboardingDraftProvider } from './screens/onboardingDraft';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles/theme.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RepositoryProvider>
        <OnboardingDraftProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </OnboardingDraftProvider>
      </RepositoryProvider>
    </ThemeProvider>
  </StrictMode>,
);
