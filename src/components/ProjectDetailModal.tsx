import React, { useState, useEffect } from 'react';
import type { RepositoryState } from '../types/radar.js';
import { formatHarnessSummary } from '../lib/radar-core.js';
import {
  X,
  GitBranch,
  Folder,
  Copy,
  Check,
  Clock,
  GitCommit as GitCommitIcon,
  FileText,
  Eye,
  History,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Bot,
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: RepositoryState;
  onClose: () => void;
  onSaveNext: (repoPath: string, text: string) => Promise<void>;
  onMarkSeen: (project: RepositoryState) => Promise<void>;
  onToggleIgnore: (repoPath: string) => Promise<void>;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onSaveNext,
  onMarkSeen,
  onToggleIgnore,
}) => {
  const [isEditingNext, setIsEditingNext] = useState(false);
  const [nextText, setNextText] = useState(project.next || '');
  const [isSavingNext, setIsSavingNext] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedCd, setCopiedCd] = useState(false);

  useEffect(() => {
    setNextText(project.next || '');
    // Automatically record last seen state when opened so next visit can see diff
    onMarkSeen(project);
  }, [project.path]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditingNext) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditingNext]);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(project.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCd = () => {
    navigator.clipboard.writeText(`cd "${project.path}"`);
    setCopiedCd(true);
    setTimeout(() => setCopiedCd(false), 2000);
  };

  const handleSaveNext = async () => {
    try {
      setIsSavingNext(true);
      await onSaveNext(project.path, nextText);
      setIsEditingNext(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNext(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0b0f16] border border-[#232b3b] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b2332] bg-[#0e141e]/70">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                project.attentionGroup === 'NEEDS_ME'
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : project.attentionGroup === 'RECENTLY_ACTIVE'
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2 truncate">
                {project.name}
              </h2>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1 text-zinc-300">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
                  {project.currentBranch}
                </span>
                <span>·</span>
                <span title={project.path} className="truncate max-w-xs text-zinc-500">
                  {project.path}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCd}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-[#16202e] hover:bg-[#1f2b3e] text-zinc-300 border border-[#2b374a] transition-colors"
              title="Copy cd command"
            >
              {copiedCd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCd ? 'Copied cd' : 'cd'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-zinc-200">
          {/* Attention Banner if Needs Me */}
          {project.attentionGroup === 'NEEDS_ME' && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1">
                <strong>NEEDS ME:</strong> {project.needsMeReasons.join(' · ')}
              </div>
            </div>
          )}

          {/* NEXT Note Section */}
          <div className="bg-[#101722] border border-[#232f42] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-amber-400 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                  NEXT
                </span>
                <span className="text-xs text-zinc-400">Human intention breadcrumb</span>
              </div>
              {!isEditingNext && (
                <button
                  onClick={() => setIsEditingNext(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-mono"
                >
                  {project.next ? 'Edit' : '+ Add NEXT note'}
                </button>
              )}
            </div>

            {isEditingNext ? (
              <div className="space-y-2 mt-2">
                <textarea
                  value={nextText}
                  onChange={(e) => setNextText(e.target.value)}
                  placeholder="What did you intend to do next? (e.g. Implement Phase 1 retention after reviewing Phase 0 report)"
                  rows={2}
                  className="w-full bg-[#090d14] text-xs text-zinc-100 p-2.5 rounded border border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNextText(project.next || '');
                      setIsEditingNext(false);
                    }}
                    className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNext}
                    disabled={isSavingNext}
                    className="px-3 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-black rounded"
                  >
                    {isSavingNext ? 'Saving...' : 'Save NEXT'}
                  </button>
                </div>
              </div>
            ) : project.next ? (
              <p className="text-sm font-medium text-zinc-100 mt-1 leading-relaxed bg-[#0b1018] p-3 rounded border-l-2 border-l-amber-400 border border-[#1b2535]">
                {project.next}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 italic mt-1">
                No NEXT breadcrumb recorded yet. Click to record what you intended to do next.
              </p>
            )}
          </div>

          {/* SINCE YOU LAST LOOKED */}
          <div className="bg-[#101620] border border-[#202a3a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Eye className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                Since You Last Looked
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs font-mono text-zinc-300">
              {project.sinceLastLooked && project.sinceLastLooked.length > 0 ? (
                project.sinceLastLooked.map((statement, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <span>{statement}</span>
                  </li>
                ))
              ) : (
                <li className="text-zinc-500 italic">No previous visit recorded.</li>
              )}
            </ul>
          </div>

          {/* ACTIVITY SOURCES & HARNESSES */}
          <div className="bg-[#101620] border border-[#202a3a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                  Activity Sources &amp; Harnesses
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Ordered by latest user interaction</span>
            </div>

            {project.harnessActivities && project.harnessActivities.length > 0 ? (
              <div className="space-y-2">
                {project.harnessActivities.map((harness, idx) => {
                  const summary = formatHarnessSummary(harness);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded bg-[#0b1018] border border-[#1b2535] text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60 font-semibold text-[10px]">
                            {summary.sourceName}
                          </span>
                          <span className="text-zinc-200 font-semibold">{harness.sessionTitle || harness.sessionId || 'Session'}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">{summary.relativeTime}</span>
                      </div>

                      <div className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                        <span className="text-amber-400/90 font-medium shrink-0">Last User Interaction:</span>
                        <span>{summary.statusLabel}</span>
                      </div>

                      {summary.previewText && (
                        <div className="p-2 rounded bg-[#070b10] border border-zinc-800/80 text-zinc-400 text-[11px] italic">
                          &ldquo;{summary.previewText}&rdquo;
                        </div>
                      )}

                      {harness.hasAgentResponseAfterLastUserInteraction && (
                        <div className="text-[10px] text-emerald-400/80">
                          ✓ Agent response followed previous user interaction
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic font-mono">
                No external harness activity (Codex / ChatGPT) associated yet. Working with physical Git state.
              </p>
            )}
          </div>

          {/* CURRENT STATE MATRIX */}
          <div>
            <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
              Current State
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="bg-[#0e141f] border border-[#1c2534] p-3 rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Working Tree</span>
                <span className={`text-sm font-semibold mt-1 block ${project.isClean ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {project.isClean ? 'Clean' : 'Dirty'}
                </span>
              </div>
              <div className="bg-[#0e141f] border border-[#1c2534] p-3 rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Modified / Untracked</span>
                <span className="text-sm font-semibold text-zinc-200 mt-1 block">
                  {project.modifiedCount} / {project.untrackedCount}
                </span>
              </div>
              <div className="bg-[#0e141f] border border-[#1c2534] p-3 rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Staged / Deleted</span>
                <span className="text-sm font-semibold text-zinc-200 mt-1 block">
                  {project.stagedCount} / {project.deletedCount}
                </span>
              </div>
              <div className="bg-[#0e141f] border border-[#1c2534] p-3 rounded-lg">
                <span className="text-zinc-500 block text-[11px]">Stashes</span>
                <span className="text-sm font-semibold text-zinc-200 mt-1 block">
                  {project.stashCount}
                </span>
              </div>
            </div>

            {project.upstream && (
              <div className="mt-2.5 text-xs font-mono text-zinc-400 bg-[#0e141f] border border-[#1c2534] px-3 py-2 rounded-lg flex items-center justify-between">
                <span>Upstream: <strong className="text-zinc-200">{project.upstream}</strong></span>
                <span>Ahead / Behind: <strong className="text-emerald-400">+{project.ahead}</strong> / <strong className="text-amber-400">-{project.behind}</strong></span>
              </div>
            )}
          </div>

          {/* CHANGED FILES */}
          {project.changedFiles && project.changedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Changed Files ({project.changedFiles.length})</span>
                </h3>
              </div>
              <div className="bg-[#0c1017] border border-[#1b2230] rounded-lg divide-y divide-[#171e2b] max-h-56 overflow-y-auto font-mono text-xs">
                {project.changedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                          file.status === 'untracked'
                            ? 'text-zinc-400 bg-zinc-800'
                            : file.status === 'conflicted'
                            ? 'text-rose-400 bg-rose-950'
                            : file.status === 'added'
                            ? 'text-emerald-400 bg-emerald-950'
                            : file.status === 'deleted'
                            ? 'text-rose-300 bg-rose-950/60'
                            : 'text-amber-400 bg-amber-950/60'
                        }`}
                      >
                        {file.rawStatus || file.status.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-zinc-300 truncate">{file.path}</span>
                    </div>
                    {file.staged && (
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
                        staged
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RECENT COMMITS */}
          <div>
            <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5" />
              <span>Recent Commits</span>
            </h3>
            <div className="bg-[#0c1017] border border-[#1b2230] rounded-lg divide-y divide-[#171e2b] font-mono text-xs">
              {project.recentCommits && project.recentCommits.length > 0 ? (
                project.recentCommits.map((commit, idx) => (
                  <div key={idx} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-zinc-500 font-mono text-[11px] shrink-0">
                        {commit.sha}
                      </span>
                      <span className="text-zinc-200 truncate">
                        {commit.message}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 shrink-0">
                      <span>{commit.author}</span>
                      <span>·</span>
                      <span>{commit.date ? commit.date.substring(0, 10) : ''}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-zinc-500 text-xs italic">
                  No commits found in repository history.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1b2332] bg-[#0e141e]/70 flex items-center justify-between text-xs font-mono">
          <div className="text-zinc-500">
            Last active: {project.lastActivity ? new Date(project.lastActivity).toLocaleString() : 'Unknown'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleIgnore(project.path)}
              className="px-2.5 py-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 border border-zinc-800 transition-colors"
            >
              Ignore from Radar
            </button>
            <button
              onClick={handleCopyPath}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#16202e] hover:bg-[#1f2b3e] text-zinc-300 border border-[#2b374a] transition-colors"
            >
              {copiedPath ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPath ? 'Copied' : 'Copy Path'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
