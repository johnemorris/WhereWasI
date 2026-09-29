import React, { useState, useEffect } from 'react';
import type { RadarConfig } from '../types/radar.js';
import {
  X,
  FolderPlus,
  Trash2,
  Folder,
  Sliders,
  EyeOff,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  config: RadarConfig | null;
  onClose: () => void;
  onAddScanRoot: (path: string) => Promise<void>;
  onRemoveScanRoot: (path: string) => Promise<void>;
  onUnignore: (path: string) => Promise<void>;
  onSetIdleThreshold: (days: number) => Promise<void>;
  onSeedSamples: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onClose,
  onAddScanRoot,
  onRemoveScanRoot,
  onUnignore,
  onSetIdleThreshold,
  onSeedSamples,
}) => {
  const [newPath, setNewPath] = useState('');
  const [idleDays, setIdleDays] = useState(config?.idleThresholdDays || 7);
  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick directory browser suggestions
  const [browseDir, setBrowseDir] = useState<string>('');
  const [suggestedDirs, setSuggestedDirs] = useState<Array<{ name: string; path: string }>>([]);

  useEffect(() => {
    if (config) {
      setIdleDays(config.idleThresholdDays);
    }
  }, [config]);

  const loadDirectories = async (targetPath?: string) => {
    try {
      const url = targetPath
        ? `/api/fs/browse?path=${encodeURIComponent(targetPath)}`
        : '/api/fs/browse';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBrowseDir(data.current);
        setSuggestedDirs(data.directories || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDirectories();
  }, []);

  const handleAddRoot = async (pathToUse?: string) => {
    const target = pathToUse || newPath;
    if (!target.trim()) return;

    setErrorMsg(null);
    try {
      setIsAdding(true);
      await onAddScanRoot(target.trim());
      setNewPath('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleIdleChange = async (days: number) => {
    setIdleDays(days);
    await onSetIdleThreshold(days);
  };

  const handleSeedSamples = async () => {
    try {
      setIsSeeding(true);
      await onSeedSamples();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#0b0f16] border border-[#232b3b] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2332] bg-[#0e141e]/70">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Radar Settings & Scan Roots
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-zinc-300">
          {/* Scan Roots */}
          <div>
            <h3 className="font-mono text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Configured Scan Roots
            </h3>
            <p className="text-zinc-500 mb-3 text-[11px]">
              Radar recursively searches these root folders (up to 3 levels deep) for Git repositories.
            </p>

            {/* List */}
            <div className="space-y-2 mb-3">
              {config?.scanRoots && config.scanRoots.length > 0 ? (
                config.scanRoots.map((root, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#111722] border border-[#202b3c] font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate text-zinc-200">{root}</span>
                    </div>
                    <button
                      onClick={() => onRemoveScanRoot(root)}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove scan root"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-3 text-zinc-500 italic bg-[#0f141d] rounded border border-[#1b2230]">
                  No scan roots configured. Add a folder below.
                </div>
              )}
            </div>

            {/* Add Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoot()}
                  placeholder="/absolute/path/to/projects or ./sample_repos"
                  className="flex-1 bg-[#121822] text-zinc-200 placeholder:text-zinc-600 px-3 py-1.5 rounded-md border border-[#232b3b] font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => handleAddRoot()}
                  disabled={isAdding || !newPath.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-50 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Add Root</span>
                </button>
              </div>

              {errorMsg && (
                <div className="text-rose-400 text-[11px] font-mono">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Quick Browse / Sample Dogfood Button */}
            <div className="mt-4 pt-3 border-t border-[#1b2332] flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleSeedSamples}
                disabled={isSeeding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16202e] hover:bg-[#1f2b3e] text-amber-300 border border-amber-900/40 text-xs font-mono transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSeeding ? 'Generating...' : 'Load Dogfood Sample Repositories'}</span>
              </button>

              <span className="text-[11px] text-zinc-500">
                Creates FederalRegisterDigest, LOWBI, FindWPHost, UniversalBoard
              </span>
            </div>

            {/* Quick directory suggestions */}
            {suggestedDirs.length > 0 && (
              <div className="mt-3 bg-[#0d121a] p-2.5 rounded-lg border border-[#1b2433]">
                <div className="text-[11px] text-zinc-400 mb-1.5 flex items-center justify-between">
                  <span>Browse local directories in <code className="text-zinc-300">{browseDir}</code>:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {suggestedDirs.map((dir, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAddRoot(dir.path)}
                      className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-[#151c27] hover:bg-[#1e2736] text-zinc-300 border border-[#232e40] transition-colors"
                    >
                      <Folder className="w-3 h-3 text-zinc-500" />
                      <span>{dir.name}</span>
                      <span className="text-[10px] text-amber-400/80 ml-1">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Idle Threshold */}
          <div className="pt-4 border-t border-[#1b2332]">
            <h3 className="font-mono text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Recency Window & Idle Threshold
            </h3>
            <p className="text-zinc-500 mb-2 text-[11px]">
              Projects with clean working trees touched within this window appear under <strong>RECENTLY ACTIVE</strong>. Older ones appear under <strong>IDLE</strong>.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="30"
                value={idleDays}
                onChange={(e) => handleIdleChange(parseInt(e.target.value, 10))}
                className="w-48 accent-amber-400"
              />
              <span className="font-mono text-xs text-zinc-200">
                <strong>{idleDays}</strong> days
              </span>
            </div>
          </div>

          {/* Ignored Repositories */}
          {config?.ignoredPaths && config.ignoredPaths.length > 0 && (
            <div className="pt-4 border-t border-[#1b2332]">
              <h3 className="font-mono text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Ignored Repositories ({config.ignoredPaths.length})</span>
              </h3>
              <div className="space-y-1.5">
                {config.ignoredPaths.map((ignoredPath, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded bg-[#111722] border border-[#202b3c] font-mono text-[11px]"
                  >
                    <span className="truncate text-zinc-400">{ignoredPath}</span>
                    <button
                      onClick={() => onUnignore(ignoredPath)}
                      className="text-amber-400 hover:text-amber-300 font-mono text-[11px] shrink-0"
                    >
                      Unignore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1b2332] bg-[#0e141e]/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#16202e] hover:bg-[#1f2b3e] text-zinc-200 font-medium text-xs border border-[#2b374a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
