import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { QrCodesPage } from './pages/QrCodesPage';
import { QrDetailPage } from './pages/QrDetailPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicLeadCapturePage } from './pages/PublicLeadCapturePage';
import { CreateQrModal } from './components/CreateQrModal';
import { QrPreviewModal } from './components/QrPreviewModal';
import { api } from './api/client';
import { UserSession, QRCodeItem, CampaignItem } from './types';

export function App() {
  // Check if visitor is visiting public lead capture URL
  const isLeadCaptureRoute = window.location.pathname.startsWith('/lead-capture');
  if (isLeadCaptureRoute) {
    return <PublicLeadCapturePage />;
  }

  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);

  // Shared Data State
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  // Modals
  const [isCreateQrOpen, setIsCreateQrOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<QRCodeItem | null>(null);
  const [previewQr, setPreviewQr] = useState<QRCodeItem | null>(null);

  // Check initial authentication
  useEffect(() => {
    api.getMe()
      .then((res) => {
        setCurrentUser(res.user);
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  // Fetch campaigns and QRs when authenticated
  const reloadAppData = async () => {
    try {
      const [qrsRes, campsRes] = await Promise.all([
        api.getQRCodes(),
        api.getCampaigns(),
      ]);
      setQrCodes(qrsRes.qrCodes);
      setCampaigns(campsRes.campaigns);
    } catch (err) {
      console.error('Error fetching global app data:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      reloadAppData();
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  const handleOpenCreateQr = () => {
    setEditingQr(null);
    setIsCreateQrOpen(true);
  };

  const handleEditQr = (qr: QRCodeItem) => {
    setEditingQr(qr);
    setIsCreateQrOpen(true);
  };

  const handleViewPreview = (qr: QRCodeItem) => {
    setPreviewQr(qr);
  };

  const handleViewAnalytics = (qrId: string) => {
    setSelectedQrId(qrId);
    setCurrentTab('qr_detail');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center text-xs text-[#888888]">
        <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent animate-spin mb-3" />
        <span className="font-serif-luxury text-base tracking-widest text-[#111111] uppercase">AEVY</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#111111] flex flex-col font-sans selection:bg-[#C6A46A]/20">
      {/* Top Bar Header */}
      <Navbar
        currentTab={currentTab === 'qr_detail' ? 'qrcodes' : currentTab}
        onSelectTab={(tab) => {
          setSelectedQrId(null);
          setCurrentTab(tab);
        }}
        onOpenCreateQr={handleOpenCreateQr}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {currentTab === 'dashboard' && (
          <DashboardPage
            onOpenCreateQr={handleOpenCreateQr}
            onNavigateToQrCodes={() => setCurrentTab('qrcodes')}
            onNavigateToAnalytics={() => setCurrentTab('analytics')}
            onViewQrDetails={handleViewAnalytics}
            onViewQrPreview={handleViewPreview}
          />
        )}

        {currentTab === 'qrcodes' && (
          <QrCodesPage
            onOpenCreateQr={handleOpenCreateQr}
            onEditQr={handleEditQr}
            onViewPreview={handleViewPreview}
            onViewAnalytics={handleViewAnalytics}
            campaigns={campaigns}
          />
        )}

        {currentTab === 'qr_detail' && selectedQrId && (
          <QrDetailPage
            qrId={selectedQrId}
            onBack={() => setCurrentTab('qrcodes')}
            onOpenPreview={handleViewPreview}
          />
        )}

        {currentTab === 'campaigns' && (
          <CampaignsPage
            onSelectQr={handleViewAnalytics}
            onOpenCreateQr={handleOpenCreateQr}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsPage
            qrCodes={qrCodes}
            campaigns={campaigns}
          />
        )}

        {currentTab === 'visitors' && (
          <VisitorsPage
            qrCodes={qrCodes}
            campaigns={campaigns}
          />
        )}

        {currentTab === 'data' && <DataManagementPage />}

        {currentTab === 'settings' && <SettingsPage />}
      </main>

      {/* Modals */}
      <CreateQrModal
        isOpen={isCreateQrOpen}
        onClose={() => setIsCreateQrOpen(false)}
        onSuccess={(savedQr) => {
          reloadAppData();
          setPreviewQr(savedQr);
        }}
        editItem={editingQr}
        campaigns={campaigns}
      />

      <QrPreviewModal
        isOpen={Boolean(previewQr)}
        onClose={() => setPreviewQr(null)}
        qrCode={previewQr}
      />

      {/* Footer */}
      <footer className="border-t border-[#E8E4DC] bg-white py-5 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#888888] gap-2">
          <div className="flex items-center gap-2">
            <span className="font-serif-luxury font-bold tracking-widest text-[#111111] uppercase">AEVY</span>
            <span>·</span>
            <span>Essence of Fresh Elegance</span>
          </div>
          <div className="text-[11px] font-mono-tabular">
            Packaging QR Dynamic Telemetry · Atomic JSON Database Storage
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
