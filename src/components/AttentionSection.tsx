import React, { useState } from 'react';
import type { AttentionGroup, RepositoryState } from '../types/radar.js';
import { ProjectRow } from './ProjectRow.js';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AttentionSectionProps {
  title: string;
  group: AttentionGroup;
  projects: RepositoryState[];
  onOpenDetail: (project: RepositoryState) => void;
  onSaveNext: (repoPath: string, text: string) => Promise<void>;
  defaultExpanded?: boolean;
}

export const AttentionSection: React.FC<AttentionSectionProps> = ({
  title,
  group,
  projects,
  onOpenDetail,
  onSaveNext,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (projects.length === 0) return null;

  const isNeedsMe = group === 'NEEDS_ME';
  const isRecent = group === 'RECENTLY_ACTIVE';

  return (
    <section className="space-y-2">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left py-1 group focus:outline-none"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
          )}

          <h2 className="text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-2 text-zinc-300">
            <span>{title}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                isNeedsMe
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold'
                  : isRecent
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                  : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40'
              }`}
            >
              {projects.length}
            </span>
          </h2>
        </div>

        <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-400">
          {isNeedsMe
            ? 'Unfinished work, active NEXT, dirty state, or stashes'
            : isRecent
            ? 'Recently active · Clean working tree'
            : 'No recent activity · Clean'}
        </span>
      </button>

      {/* Project Rows */}
      {isExpanded && (
        <div className="space-y-2">
          {projects.map((proj) => (
            <ProjectRow
              key={proj.id}
              project={proj}
              onOpenDetail={onOpenDetail}
              onSaveNext={onSaveNext}
            />
          ))}
        </div>
      )}
    </section>
  );
};
