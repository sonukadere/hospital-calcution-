import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { ShareManagementPage } from './pages/ShareManagementPage';
import { MasterRatePage } from './pages/MasterRatePage';
import { ShareManagementNewPage } from './pages/ShareManagementNewPage';

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isShareManagement = location.pathname === '/' || location.pathname === '/share-management';

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fb] text-slate-900 font-sans">
      {/* Left Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isShareManagement && (
          <TopNav
            title="Billing Share Distribution"
            subtitle="Veda & Sodani Share Distribution based on Master Rates"
          />
        )}

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <Routes>
            <Route path="/" element={<Navigate to="/share-management" replace />} />
            <Route path="/share-management" element={<ShareManagementNewPage />} />
            <Route path="/dashboard" element={<ShareManagementPage />} />
            <Route path="/billing" element={<ShareManagementPage />} />
            <Route path="/master-rates" element={<MasterRatePage />} />
            <Route path="/reports" element={<ShareManagementPage />} />
            <Route path="/settings" element={<MasterRatePage />} />
            <Route path="*" element={<Navigate to="/share-management" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
};

export default App;
