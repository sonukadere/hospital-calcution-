import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { ShareManagementPage } from './pages/ShareManagementPage';
import { MasterRatePage } from './pages/MasterRatePage';

const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans">
      {/* Left Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <Routes>
            <Route path="/" element={<Navigate to="/share-management" replace />} />
            <Route path="/share-management" element={<ShareManagementPage />} />
            <Route path="/master-rates" element={<MasterRatePage />} />
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

