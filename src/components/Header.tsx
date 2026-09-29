import React from 'react';
import { Search, RefreshCw, FolderPlus, Settings as SettingsIcon, AlertCircle, Github } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  onAddFolder: () => void;
  onOpenExport: () => void;
  repoCount: number;
  needsMeCount: number;
  lastScannedAt: string | null;
  errorsCount: number;
  onViewErrors?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  onAddFolder,
  onOpenExport,
  repoCount,
  needsMeCount,
  lastScannedAt,
  errorsCount,
  onViewErrors,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-[#090d13]/90 backdrop-blur-md border-b border-[#1f2633] px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" />
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
              Agent Project Radar
              <span className="text-[11px] font-mono text-zinc-400 font-normal px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60">
                local-first
              </span>
            </h1>
          </div>

          {repoCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400 border-l border-zinc-800 pl-3">
              <span>
                <strong className="text-zinc-200">{repoCount}</strong> {repoCount === 1 ? 'repo' : 'repos'}
              </span>
              <span>·</span>
              <span className={needsMeCount > 0 ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                <strong>{needsMeCount}</strong> needs attention
              </span>
            </div>
          )}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 md:max-w-lg md:justify-end">
          {/* Search input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects, branch, path, NEXT..."
              className="w-full bg-[#121822] text-xs text-zinc-200 placeholder:text-zinc-500 pl-8 pr-3 py-1.5 rounded-md border border-[#232b3b] focus:border-amber-400/70 focus:outline-none focus:ring-1 focus:ring-amber-400/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Add folder */}
          <button
            onClick={onAddFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#16202e] hover:bg-[#1e2b3e] text-zinc-200 border border-[#2b374a] transition-colors"
            title="Add scan root folder"
          >
            <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Add Root</span>
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#16202e] hover:bg-[#1e2b3e] text-zinc-200 border border-[#2b374a] transition-colors disabled:opacity-50"
            title="Rescan repositories"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Rescan</span>
          </button>

          {/* Export to GitHub / ZIP (convenient for mobile users) */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors shadow-sm"
            title="Export / Push to GitHub"
          >
            <Github className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md bg-[#16202e] hover:bg-[#1e2b3e] text-zinc-400 hover:text-zinc-200 border border-[#2b374a] transition-colors"
            title="Settings & Roots"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>

          {/* Errors indicator if any */}
          {errorsCount > 0 && (
            <button
              onClick={onViewErrors}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/40 border border-rose-800/60 text-[11px] font-mono text-rose-300 hover:bg-rose-900/50"
              title={`${errorsCount} scan warnings/errors`}
            >
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>{errorsCount}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
