import React, { useState, useRef, useEffect } from 'react';
import type { RepositoryState } from '../types/radar.js';
import { formatDashboardEvidence, formatHarnessSummary } from '../lib/radar-core.js';
import { GitBranch, CornerDownRight, Check, X, Edit2, AlertCircle, Bot } from 'lucide-react';

interface ProjectRowProps {
  project: RepositoryState;
  onOpenDetail: (project: RepositoryState) => void;
  onSaveNext: (repoPath: string, text: string) => Promise<void>;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({
  project,
  onOpenDetail,
  onSaveNext,
}) => {
  const [isEditingNext, setIsEditingNext] = useState(false);
  const [nextValue, setNextValue] = useState(project.next || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external NEXT changes
  useEffect(() => {
    if (!isEditingNext) {
      setNextValue(project.next || '');
    }
  }, [project.next, isEditingNext]);

  useEffect(() => {
    if (isEditingNext && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingNext]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingNext(true);
  };

  const handleCancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    setNextValue(project.next || '');
    setIsEditingNext(false);
  };

  const handleSaveEdit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      setIsSaving(true);
      await onSaveNext(project.path, nextValue);
      setIsEditingNext(false);
    } catch (err) {
      console.error('Failed to save NEXT:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
  };

  // Group specific accent styling
  const isNeedsMe = project.attentionGroup === 'NEEDS_ME';
  const isRecent = project.attentionGroup === 'RECENTLY_ACTIVE';

  return (
    <div
      onClick={() => onOpenDetail(project)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditingNext) {
          onOpenDetail(project);
        } else if (e.key === 'e' && !isEditingNext) {
          e.preventDefault();
          setIsEditingNext(true);
        }
      }}
      className={`group relative flex flex-col gap-2 p-3.5 sm:px-4 sm:py-3.5 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/60 ${
        isNeedsMe
          ? 'bg-[#10151f] hover:bg-[#141b28] border-[#222c3d]'
          : isRecent
          ? 'bg-[#0c1017] hover:bg-[#101621] border-[#1b2230]'
          : 'bg-[#0a0e15] hover:bg-[#0f1420] border-[#1b2332]'
      }`}
    >
      {/* Top line: Project Name + Recency + Branch + Dirty State */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Attention indicator pip */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isNeedsMe
                ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                : isRecent
                ? 'bg-emerald-400/80'
                : 'bg-zinc-600'
            }`}
            title={project.attentionGroup}
          />

          {/* Project Name */}
          <span className="font-semibold text-sm text-zinc-100 tracking-tight group-hover:text-amber-300 transition-colors truncate">
            {project.name}
          </span>

          {/* Recency badge */}
          <span className="text-[11px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/40 shrink-0">
            {project.lastActivityRelative || 'Unknown'}
          </span>

          {/* Branch badge */}
          <div className="flex items-center gap-1 text-xs font-mono text-zinc-300 px-2 py-0.5 rounded bg-[#16202e] border border-[#26354a] shrink-0 max-w-[200px] sm:max-w-xs md:max-w-md truncate">
            <GitBranch className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate">{project.currentBranch}</span>
            {project.ahead > 0 && <span className="text-emerald-400 text-[10px]">↑{project.ahead}</span>}
            {project.behind > 0 && <span className="text-amber-400 text-[10px]">↓{project.behind}</span>}
          </div>
        </div>

        {/* Status / Classification Evidence */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0 ml-auto">
          {project.error ? (
            <span className="flex items-center gap-1 text-rose-400 text-[11px]">
              <AlertCircle className="w-3 h-3" />
              <span>Git warning</span>
            </span>
          ) : (() => {
              const evidence = project.dashboardEvidence || formatDashboardEvidence(project);
              if (evidence === 'Clean') {
                return <span className="text-emerald-400/80 font-normal text-[11px]">Clean</span>;
              }
              const tokens = evidence.split(' · ');
              return (
                <div className="flex items-center gap-1 text-[11px]">
                  {tokens.map((token, idx) => {
                    let colorClass = 'text-zinc-300';
                    if (token === 'Clean') colorClass = 'text-emerald-400/90 font-normal';
                    else if (token.includes('conflicted')) colorClass = 'text-rose-400 font-semibold';
                    else if (token.includes('modified')) colorClass = 'text-amber-300 font-medium';
                    else if (token.includes('staged')) colorClass = 'text-emerald-400 font-medium';
                    else if (token.includes('untracked')) colorClass = 'text-zinc-400';
                    else if (token.includes('deleted')) colorClass = 'text-rose-300';
                    else if (token.includes('stash'))
                      colorClass =
                        'text-blue-300 bg-blue-950/60 px-1 py-0.5 rounded border border-blue-800/50';

                    return (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-zinc-600 px-0.5">·</span>}
                        <span className={colorClass}>{token}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Harness Activity line (e.g. Codex, ChatGPT) if associated */}
      {project.harnessActivities && project.harnessActivities.length > 0 && (
        <div className="flex items-center gap-2 text-xs font-mono py-1 px-2 rounded bg-[#0b1019]/70 border border-[#1b2536] text-zinc-300">
          {project.harnessActivities.slice(0, 1).map((harness, i) => {
            const summary = formatHarnessSummary(harness);
            return (
              <div key={i} className="flex items-center gap-2 truncate w-full text-[11px]">
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/50 font-semibold shrink-0">
                  <Bot className="w-3 h-3 text-sky-400" />
                  <span>{summary.sourceName} · {summary.relativeTime}</span>
                </span>
                <span className="text-zinc-200 font-medium shrink-0">
                  {summary.statusLabel}
                </span>
                {summary.previewText && (
                  <span className="text-zinc-400 truncate">
                    &ldquo;{summary.previewText}&rdquo;
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Middle line: NEXT breadcrumb (Prominent & Inline Editable) */}
      <div
        className="mt-0.5"
        onClick={(e) => {
          if (!isEditingNext) {
            handleStartEdit(e);
          }
        }}
      >
        {isEditingNext ? (
          <div
            className="flex items-center gap-2 bg-[#0a0e14] p-1.5 rounded-md border border-amber-400/70"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] font-mono font-bold tracking-wider text-amber-400 px-1 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 shrink-0">
              NEXT
            </span>
            <input
              ref={inputRef}
              type="text"
              value={nextValue}
              onChange={(e) => setNextValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              placeholder="What did you intend to do next? (Enter saves, Esc cancels)"
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="p-1 rounded hover:bg-emerald-900/50 text-emerald-400 transition-colors"
                title="Save (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : project.next ? (
          <div className="flex items-start justify-between gap-2 p-2 rounded-md bg-[#131b26] border-l-2 border-l-amber-400 border-t border-r border-b border-[#202c3e] group/next hover:border-amber-400/50 transition-colors">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-[10px] font-mono font-bold tracking-wider text-amber-400 px-1 py-0.5 rounded bg-amber-950/50 shrink-0 mt-0.5">
                NEXT
              </span>
              <p className="text-xs text-zinc-200 font-medium leading-relaxed break-words">
                {project.next}
              </p>
            </div>
            <button
              onClick={handleStartEdit}
              className="opacity-0 group-hover/next:opacity-100 text-zinc-500 hover:text-zinc-200 p-1 rounded shrink-0 transition-opacity"
              title="Edit NEXT note (press 'e')"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group/addnext py-0.5">
            <button
              onClick={handleStartEdit}
              className="text-[11px] font-mono text-zinc-500 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <span className="opacity-60">+</span>
              <span>Set NEXT breadcrumb...</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom line: Latest Commit summary */}
      {project.headMessage && (
        <div className="flex items-center gap-2 text-xs text-zinc-400/90 font-mono truncate pt-0.5">
          <CornerDownRight className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-zinc-500 shrink-0">{project.headSha || 'head'}</span>
          <span className="text-zinc-300 truncate">
            {project.headMessage}
          </span>
          {project.headAuthor && (
            <span className="text-zinc-500 text-[11px] hidden sm:inline shrink-0">
              · {project.headAuthor}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
