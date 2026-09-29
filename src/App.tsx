/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  RepositoryState,
  RadarConfig,
  ScanResult,
  LastSeenState,
} from './types/radar.js';
import { Header } from './components/Header.js';
import { AttentionSection } from './components/AttentionSection.js';
import { ProjectDetailModal } from './components/ProjectDetailModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ExportModal } from './components/ExportModal.js';
import { EmptyState } from './components/EmptyState.js';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState<RepositoryState[]>([]);
  const [config, setConfig] = useState<RadarConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [showErrorsModal, setShowErrorsModal] = useState(false);

  // Modals
  const [selectedProject, setSelectedProject] = useState<RepositoryState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Load config & scan
  const fetchScan = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [scanRes, configRes] = await Promise.all([
        fetch('/api/scan'),
        fetch('/api/config'),
      ]);

      if (scanRes.ok) {
        const scanData: ScanResult = await scanRes.json();
        setProjects(scanData.projects || []);
        setErrors(scanData.errors || []);
        setLastScannedAt(scanData.scannedAt || new Date().toISOString());

        // Update selectedProject if currently viewing one
        if (selectedProject) {
          const updated = scanData.projects.find((p) => p.path === selectedProject.path);
          if (updated) setSelectedProject(updated);
        }
      }

      if (configRes.ok) {
        const configData: RadarConfig = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error('Failed to fetch radar state:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchScan();
  }, []);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input or textarea, skip global shortcuts
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'r') {
        e.preventDefault();
        fetchScan();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchScan]);

  // Save NEXT note
  const handleSaveNext = async (repoPath: string, text: string) => {
    const res = await fetch('/api/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, text }),
    });

    if (res.ok) {
      // Optimistically update NEXT note without altering attention classification
      setProjects((prev) =>
        prev.map((p) => {
          if (p.path === repoPath) {
            const updatedNext = text.trim() || null;
            return {
              ...p,
              next: updatedNext,
            };
          }
          return p;
        })
      );

      // Background rescan to update groups properly
      fetchScan();
    }
  };

  // Record Last Seen
  const handleMarkSeen = async (project: RepositoryState) => {
    const state: LastSeenState = {
      timestamp: new Date().toISOString(),
      headSha: project.headSha,
      branch: project.currentBranch,
      isClean: project.isClean,
      modifiedCount: project.modifiedCount,
      stagedCount: project.stagedCount,
      untrackedCount: project.untrackedCount,
    };

    await fetch('/api/last-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: project.path, state }),
    });
  };

  // Toggle Ignore
  const handleToggleIgnore = async (repoPath: string) => {
    await fetch('/api/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    });
    if (selectedProject?.path === repoPath) {
      setSelectedProject(null);
    }
    fetchScan();
  };

  // Scan Root actions
  const handleAddScanRoot = async (path: string) => {
    const res = await fetch('/api/scan-roots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add root');
    }
    await fetchScan();
  };

  const handleRemoveScanRoot = async (path: string) => {
    await fetch('/api/scan-roots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    await fetchScan();
  };

  const handleSetIdleThreshold = async (days: number) => {
    await fetch('/api/settings/idle-threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    await fetchScan();
  };

  const handleSeedSamples = async () => {
    await fetch('/api/seed-samples', { method: 'POST' });
    await fetchScan();
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return projects;

    return projects.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.currentBranch.toLowerCase().includes(q) ||
        (p.next && p.next.toLowerCase().includes(q)) ||
        (p.headMessage && p.headMessage.toLowerCase().includes(q))
      );
    });
  }, [projects, searchQuery]);

  // Grouped projects
  const needsMeProjects = useMemo(
    () => filteredProjects.filter((p) => p.attentionGroup === 'NEEDS_ME'),
    [filteredProjects]
  );

  const recentlyActiveProjects = useMemo(
    () => filteredProjects.filter((p) => p.attentionGroup === 'RECENTLY_ACTIVE'),
    [filteredProjects]
  );

  const idleProjects = useMemo(
    () => filteredProjects.filter((p) => p.attentionGroup === 'IDLE'),
    [filteredProjects]
  );

  const hasScanRoots = (config?.scanRoots && config.scanRoots.length > 0) || false;

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={fetchScan}
        isRefreshing={isRefreshing}
        onOpenSettings={() => setShowSettings(true)}
        onAddFolder={() => setShowSettings(true)}
        onOpenExport={() => setShowExport(true)}
        repoCount={projects.length}
        needsMeCount={needsMeProjects.length}
        lastScannedAt={lastScannedAt}
        errorsCount={errors.length}
        onViewErrors={() => setShowErrorsModal(true)}
      />

      {/* Main Attention Feed */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {!hasScanRoots && projects.length === 0 ? (
          <EmptyState
            onAddFolder={handleAddScanRoot}
            onSeedDogfood={handleSeedSamples}
          />
        ) : (
          <div className="space-y-8">
            {/* Search result summary if active */}
            {searchQuery && (
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-800">
                <span>
                  Filtering by &quot;<strong>{searchQuery}</strong>&quot; ({filteredProjects.length} matches)
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-amber-400 hover:underline"
                >
                  Clear filter
                </button>
              </div>
            )}

            {filteredProjects.length === 0 && searchQuery ? (
              <div className="text-center py-16 text-zinc-500 font-mono text-xs">
                No repositories matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <>
                {/* 1. NEEDS ME */}
                <AttentionSection
                  title="NEEDS ME"
                  group="NEEDS_ME"
                  projects={needsMeProjects}
                  onOpenDetail={setSelectedProject}
                  onSaveNext={handleSaveNext}
                  defaultExpanded={true}
                />

                {/* 2. RECENTLY ACTIVE */}
                <AttentionSection
                  title="RECENTLY ACTIVE"
                  group="RECENTLY_ACTIVE"
                  projects={recentlyActiveProjects}
                  onOpenDetail={setSelectedProject}
                  onSaveNext={handleSaveNext}
                  defaultExpanded={true}
                />

                {/* 3. IDLE */}
                <AttentionSection
                  title="IDLE"
                  group="IDLE"
                  projects={idleProjects}
                  onOpenDetail={setSelectedProject}
                  onSaveNext={handleSaveNext}
                  defaultExpanded={true}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer info bar */}
      <footer className="border-t border-[#131b26] py-3 px-6 text-center text-[11px] font-mono text-zinc-500 flex flex-wrap items-center justify-between max-w-6xl mx-auto w-full gap-2">
        <div className="flex items-center gap-3">
          <span>Agent Project Radar</span>
          <span>·</span>
          <span>Deterministic Git &amp; NEXT</span>
          <span>·</span>
          <span>No AI &middot; Local-first &middot; Read-only</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-400">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300">r</kbd> to rescan</span>
          <span>·</span>
          <span>Click NEXT to edit</span>
        </div>
      </footer>

      {/* Modals */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSaveNext={handleSaveNext}
          onMarkSeen={handleMarkSeen}
          onToggleIgnore={handleToggleIgnore}
        />
      )}

      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onAddScanRoot={handleAddScanRoot}
          onRemoveScanRoot={handleRemoveScanRoot}
          onUnignore={handleToggleIgnore}
          onSetIdleThreshold={handleSetIdleThreshold}
          onSeedSamples={handleSeedSamples}
        />
      )}

      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}

      {/* Errors / Warnings Modal */}
      {showErrorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0b0f16] border border-[#232b3b] rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2332] mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Scan Warnings ({errors.length})</h3>
              </div>
              <button
                onClick={() => setShowErrorsModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
              {errors.map((err, i) => (
                <div key={i} className="p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300">
                  <div className="font-semibold text-zinc-200">{err.path}</div>
                  <div className="text-rose-400 mt-0.5">{err.message}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowErrorsModal(false)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
