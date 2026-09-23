import React from 'react';
import { Plus, LogOut, ExternalLink } from 'lucide-react';
import { UserSession } from '../types';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenCreateQr: () => void;
  currentUser: UserSession | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreateQr,
  currentUser,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'qrcodes', label: 'QR Codes' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'analytics', label: 'Scan Analytics' },
    { id: 'visitors', label: 'Visitors' },
    { id: 'data', label: 'Data & Backup' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E8E4DC] px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <span className="font-serif-luxury text-xl font-bold tracking-widest text-[#111111] uppercase group-hover:text-[#C6A46A] transition-colors">
              AEVY
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#888888] border-l border-[#E8E4DC] pl-2.5 py-0.5">
              QR Studio
            </span>
          </button>
        </div>

        {/* Zone 2: 4-7 clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-[#666666]">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`whitespace-nowrap transition-colors py-1 relative ${
                  isActive
                    ? 'text-[#111111] font-semibold'
                    : 'text-[#666666] hover:text-[#111111]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#111111]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCreateQr}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New QR</span>
          </button>

          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#E8E4DC]">
              <span className="hidden sm:inline text-xs text-[#888888] font-mono-tabular">
                {currentUser.username}
              </span>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-1.5 text-[#888888] hover:text-[#111111] hover:bg-[#F7F5F0] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="lg:hidden flex items-center gap-4 overflow-x-auto pt-2 text-xs border-t border-[#F0ECE4] mt-2.5 pb-1">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`whitespace-nowrap py-1 px-1.5 ${
                isActive
                  ? 'text-[#111111] font-semibold border-b border-[#111111]'
                  : 'text-[#888888]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
