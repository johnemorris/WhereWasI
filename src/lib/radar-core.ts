import type {
  AttentionGroup,
  GitChangedFile,
  LastSeenState,
  RepositoryState,
  HarnessActivity,
} from '../types/radar.js';

/**
 * Parses git status --porcelain=v2 --branch --show-stash output.
 */
export function parsePorcelainV2(output: string): {
  headSha: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  stashCount: number;
  isDetached: boolean;
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  deletedCount: number;
  conflictedCount: number;
  changedFiles: GitChangedFile[];
} {
  let headSha = '';
  let branch = '';
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  let stashCount = 0;
  let isDetached = false;

  let stagedCount = 0;
  let modifiedCount = 0;
  let untrackedCount = 0;
  let deletedCount = 0;
  let conflictedCount = 0;

  const changedFiles: GitChangedFile[] = [];

  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Headers
    if (line.startsWith('# branch.oid ')) {
      const oid = line.substring(13).trim();
      headSha = oid === '(initial)' ? '' : oid.substring(0, 7);
      continue;
    }
    if (line.startsWith('# branch.head ')) {
      branch = line.substring(14).trim();
      if (branch === '(detached)') {
        isDetached = true;
      }
      continue;
    }
    if (line.startsWith('# branch.upstream ')) {
      upstream = line.substring(18).trim();
      continue;
    }
    if (line.startsWith('# branch.ab ')) {
      const parts = line.substring(12).trim().split(' ');
      if (parts[0]) ahead = Math.abs(parseInt(parts[0], 10)) || 0;
      if (parts[1]) behind = Math.abs(parseInt(parts[1], 10)) || 0;
      continue;
    }
    if (line.startsWith('# stash ')) {
      stashCount = parseInt(line.substring(8).trim(), 10) || 0;
      continue;
    }

    // Untracked
    if (line.startsWith('? ')) {
      const filePath = line.substring(2).trim();
      untrackedCount++;
      changedFiles.push({
        path: filePath,
        status: 'untracked',
        staged: false,
        rawStatus: '??',
      });
      continue;
    }

    // Unmerged / Conflicted
    if (line.startsWith('u ')) {
      const parts = line.split(' ');
      const filePath = parts.slice(10).join(' ').trim();
      conflictedCount++;
      changedFiles.push({
        path: filePath || parts[parts.length - 1],
        status: 'conflicted',
        staged: false,
        rawStatus: 'UU',
      });
      continue;
    }

    // Ordinary changes: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
    if (line.startsWith('1 ')) {
      const parts = line.split(' ');
      const xy = parts[1] || '..';
      const filePath = parts.slice(8).join(' ').trim();
      const x = xy[0]; // Staged
      const y = xy[1]; // Unstaged

      let isStaged = false;
      let status: GitChangedFile['status'] = 'modified';

      if (x !== '.') {
        stagedCount++;
        isStaged = true;
        if (x === 'A') status = 'added';
        else if (x === 'D') {
          status = 'deleted';
          deletedCount++;
        }
      }

      if (y !== '.') {
        if (y === 'M') modifiedCount++;
        else if (y === 'D') {
          deletedCount++;
          status = 'deleted';
        }
      }

      changedFiles.push({
        path: filePath,
        status,
        staged: isStaged,
        rawStatus: xy,
      });
      continue;
    }

    // Renamed or copied: 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
    if (line.startsWith('2 ')) {
      const parts = line.split(' ');
      const xy = parts[1] || '..';
      // remainder after index 9 has path \t origPath
      const remainder = parts.slice(9).join(' ');
      const filePaths = remainder.split('\t');
      const filePath = filePaths[0] || '';

      if (xy[0] !== '.') stagedCount++;
      if (xy[1] !== '.') modifiedCount++;

      changedFiles.push({
        path: filePath,
        status: 'renamed',
        staged: xy[0] !== '.',
        rawStatus: xy,
      });
      continue;
    }
  }

  return {
    headSha,
    branch: branch || 'HEAD',
    upstream,
    ahead,
    behind,
    stashCount,
    isDetached,
    stagedCount,
    modifiedCount,
    untrackedCount,
    deletedCount,
    conflictedCount,
    changedFiles,
  };
}

/**
 * Classifies a repository into NEEDS_ME, RECENTLY_ACTIVE, or IDLE.
 *
 * Deterministic triggers for NEEDS_ME (Git state ONLY):
 * - Dirty working tree (modified / staged / untracked / deleted)
 * - Conflicted / unmerged state
 * - Stash exists
 *
 * NOTE: NEXT note is a human memory/re-entry breadcrumb and has ZERO effect
 * on attention classification.
 */
export function classifyAttention(
  repo: {
    isClean: boolean;
    modifiedCount: number;
    stagedCount: number;
    untrackedCount: number;
    deletedCount: number;
    conflictedCount: number;
    stashCount: number;
    lastActivity: string;
  },
  _nextNote?: string | null,
  idleThresholdDays = 7
): {
  group: AttentionGroup;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (repo.conflictedCount > 0) {
    reasons.push(
      `${repo.conflictedCount} conflicted`
    );
  }

  const dirtyParts: string[] = [];
  if (repo.modifiedCount > 0) dirtyParts.push(`${repo.modifiedCount} modified`);
  if (repo.stagedCount > 0) dirtyParts.push(`${repo.stagedCount} staged`);
  if (repo.untrackedCount > 0) dirtyParts.push(`${repo.untrackedCount} untracked`);
  if (repo.deletedCount > 0) dirtyParts.push(`${repo.deletedCount} deleted`);

  if (dirtyParts.length > 0) {
    reasons.push(dirtyParts.join(' · '));
  }

  if (repo.stashCount > 0) {
    reasons.push(`${repo.stashCount} stash${repo.stashCount === 1 ? '' : 'es'}`);
  }

  if (reasons.length > 0) {
    return {
      group: 'NEEDS_ME',
      reasons,
    };
  }

  // If not NEEDS_ME, check recency of repository activity
  const now = Date.now();
  const activityTime = repo.lastActivity ? new Date(repo.lastActivity).getTime() : 0;
  const diffDays = activityTime > 0 ? (now - activityTime) / (1000 * 60 * 60 * 24) : 999;

  if (diffDays <= idleThresholdDays) {
    return {
      group: 'RECENTLY_ACTIVE',
      reasons: ['Recently active · Clean'],
    };
  }

  return {
    group: 'IDLE',
    reasons: ['No recent activity · Clean'],
  };
}

/**
 * Formats deterministic classification and working-tree evidence for dashboard rows.
 *
 * Rules:
 * - If clean and has stashes: "Clean · N stash(es)" (e.g. "Clean · 1 stash")
 * - If clean and no stashes: "Clean"
 * - If dirty / conflicted: displays only non-zero components joined by " · ":
 *   e.g. "2 conflicted · 3 modified · 1 untracked · 1 stash"
 *   e.g. "2 modified · 3 untracked"
 *   e.g. "1 modified · 1 stash"
 *   e.g. "2 conflicted"
 *   e.g. "3 staged"
 * - NEXT has zero influence and never appears in evidence.
 */
export function formatDashboardEvidence(repo: {
  isClean: boolean;
  conflictedCount: number;
  modifiedCount: number;
  stagedCount: number;
  untrackedCount: number;
  deletedCount: number;
  stashCount: number;
  error?: string | null;
}): string {
  if (repo.error) {
    return 'Git warning';
  }

  if (repo.isClean) {
    if (repo.stashCount > 0) {
      return `Clean · ${repo.stashCount} stash${repo.stashCount === 1 ? '' : 'es'}`;
    }
    return 'Clean';
  }

  const parts: string[] = [];
  if (repo.conflictedCount > 0) {
    parts.push(`${repo.conflictedCount} conflicted`);
  }
  if (repo.modifiedCount > 0) {
    parts.push(`${repo.modifiedCount} modified`);
  }
  if (repo.stagedCount > 0) {
    parts.push(`${repo.stagedCount} staged`);
  }
  if (repo.untrackedCount > 0) {
    parts.push(`${repo.untrackedCount} untracked`);
  }
  if (repo.deletedCount > 0) {
    parts.push(`${repo.deletedCount} deleted`);
  }
  if (repo.stashCount > 0) {
    parts.push(`${repo.stashCount} stash${repo.stashCount === 1 ? '' : 'es'}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Clean';
}

/**
 * Computes deterministic "Since you last looked" delta sentences.
 */
export function computeSinceLastLooked(
  current: {
    headSha: string;
    branch: string;
    isClean: boolean;
    modifiedCount: number;
    stagedCount: number;
    untrackedCount: number;
    recentCommits: Array<{ sha: string; message: string }>;
  },
  lastSeen: LastSeenState | null
): string[] {
  if (!lastSeen) {
    return ['First time opened in Radar. We have recorded this baseline state.'];
  }

  const statements: string[] = [];

  // Branch check
  if (lastSeen.branch && current.branch !== lastSeen.branch) {
    statements.push(`Branch changed: ${lastSeen.branch} → ${current.branch}`);
  }

  // Commit / HEAD check
  if (lastSeen.headSha && current.headSha !== lastSeen.headSha) {
    // See if we can count commits since
    const commitIdx = current.recentCommits.findIndex(
      (c) => c.sha.toLowerCase().startsWith(lastSeen.headSha.toLowerCase()) || lastSeen.headSha.toLowerCase().startsWith(c.sha.toLowerCase())
    );

    if (commitIdx > 0) {
      statements.push(`${commitIdx} new commit${commitIdx === 1 ? '' : 's'} since your last visit (HEAD: ${current.headSha})`);
    } else {
      statements.push(`HEAD updated: ${lastSeen.headSha} → ${current.headSha || '(none)'}`);
    }
  }

  // Working tree state
  if (lastSeen.isClean && !current.isClean) {
    statements.push(
      `Working tree became dirty (${current.modifiedCount} modified, ${current.untrackedCount} untracked, ${current.stagedCount} staged)`
    );
  } else if (!lastSeen.isClean && current.isClean) {
    statements.push('Working tree was cleaned since your last visit');
  } else if (!current.isClean) {
    const modDiff = current.modifiedCount - (lastSeen.modifiedCount || 0);
    const untrackedDiff = current.untrackedCount - (lastSeen.untrackedCount || 0);
    if (modDiff !== 0 || untrackedDiff !== 0) {
      const parts: string[] = [];
      if (modDiff > 0) parts.push(`+${modDiff} modified`);
      else if (modDiff < 0) parts.push(`${modDiff} modified`);
      if (untrackedDiff > 0) parts.push(`+${untrackedDiff} untracked`);
      else if (untrackedDiff < 0) parts.push(`${untrackedDiff} untracked`);
      statements.push(`Working tree delta: ${parts.join(', ')}`);
    }
  }

  if (statements.length === 0) {
    const visitAge = formatRelativeTime(lastSeen.timestamp);
    statements.push(`No repository changes since you last looked (${visitAge})`);
  }

  return statements;
}

/**
 * Format a conservative relative time string (e.g. "Today", "2d", "6d", "3w", "2mo")
 */
export function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return 'Unknown';
  const timestamp = new Date(isoDate).getTime();
  if (isNaN(timestamp) || timestamp === 0) return 'Unknown';

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'Just now';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return 'Today';

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y`;
}

/**
 * Parses a Codex session record (JSON or JSONL item) into a normalized HarnessActivity.
 * Recognizes '.' as an acknowledgment (ACK), extracting timestamps and user prompts accurately.
 */
export function parseCodexSession(
  raw: any,
  sourceId: string = 'codex'
): HarnessActivity | null {
  if (!raw || typeof raw !== 'object') return null;

  const sessionId = String(raw.id || raw.sessionId || '');
  const sessionTitle = raw.title || raw.sessionTitle || undefined;
  const projectPath = raw.cwd || raw.workspacePath || raw.projectPath || undefined;
  const externalProjectName =
    raw.projectName ||
    (projectPath ? projectPath.split(/[/\\]/).filter(Boolean).pop() : undefined);

  let lastUserInteractionAt: string | undefined;
  let lastAgentInteractionAt: string | undefined;
  let lastUserText: string | undefined;
  let lastUserInteractionType: 'prompt' | 'message' | 'ack' | undefined;

  const messages = Array.isArray(raw.messages)
    ? raw.messages
    : Array.isArray(raw.history)
    ? raw.history
    : [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = String(msg.role || msg.type || '').toLowerCase();
    const content = typeof msg.content === 'string' ? msg.content : String(msg.text || '');
    const ts = msg.timestamp || msg.createdAt || msg.time;

    if (role === 'user' || role === 'human') {
      const trimmed = content.trim();
      if (ts) {
        lastUserInteractionAt = ts;
      }
      if (trimmed === '.') {
        lastUserInteractionType = 'ack';
        lastUserText = 'Previous result acknowledged';
      } else {
        lastUserInteractionType = 'prompt';
        lastUserText = trimmed;
      }
    } else if (role === 'assistant' || role === 'agent' || role === 'bot') {
      if (ts) {
        lastAgentInteractionAt = ts;
      }
    }
  }

  // Fallbacks if timestamps in messages are missing but session has updatedAt
  if (!lastUserInteractionAt && raw.updatedAt) {
    lastUserInteractionAt = raw.updatedAt;
  }

  const hasAgentResponseAfterLastUserInteraction = Boolean(
    lastUserInteractionAt &&
    lastAgentInteractionAt &&
    new Date(lastAgentInteractionAt).getTime() > new Date(lastUserInteractionAt).getTime()
  );

  return {
    sourceId: sourceId || `codex-${sessionId}`,
    sourceType: 'codex',
    displayName: 'Codex',
    projectPath,
    externalProjectName,
    sessionId: sessionId || undefined,
    sessionTitle,
    lastUserInteractionAt,
    lastAgentInteractionAt,
    lastUserInteractionType,
    lastUserText,
    hasAgentResponseAfterLastUserInteraction,
  };
}

/**
 * Orders harness activities within a logical project by the latest meaningful user interaction.
 * Older harnesses remain visible and preserved in the list.
 */
export function orderHarnessActivities(activities: HarnessActivity[]): HarnessActivity[] {
  return [...activities].sort((a, b) => {
    const aTime = a.lastUserInteractionAt ? new Date(a.lastUserInteractionAt).getTime() : 0;
    const bTime = b.lastUserInteractionAt ? new Date(b.lastUserInteractionAt).getTime() : 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    const aAgent = a.lastAgentInteractionAt ? new Date(a.lastAgentInteractionAt).getTime() : 0;
    const bAgent = b.lastAgentInteractionAt ? new Date(b.lastAgentInteractionAt).getTime() : 0;
    return bAgent - aAgent;
  });
}

/**
 * Deterministically associates harness activities with discovered repositories.
 * Preferred order:
 * 1. Exact repository/cwd path
 * 2. Persisted manual association
 * 3. Exact normalized project name (ONLY when unambiguous across all discovered repos)
 * 4. Otherwise leave unassociated (never silently guess or fuzzy match)
 */
export function associateHarnessesToRepositories(
  repositories: Array<{ path: string; name: string }>,
  harnesses: HarnessActivity[],
  sourceAssociations?: Record<string, string[]>
): Map<string, HarnessActivity[]> {
  const result = new Map<string, HarnessActivity[]>();
  for (const repo of repositories) {
    result.set(repo.path, []);
  }

  // Count occurrences of normalized repo names to detect ambiguity
  const nameCounts = new Map<string, number>();
  for (const repo of repositories) {
    const norm = repo.name.trim().toLowerCase();
    nameCounts.set(norm, (nameCounts.get(norm) || 0) + 1);
  }

  for (const harness of harnesses) {
    let matchedRepoPath: string | null = null;

    // 1. Exact path match
    if (harness.projectPath) {
      const normHarnessPath = harness.projectPath.replace(/[/\\]+$/, '');
      const found = repositories.find((r) => r.path.replace(/[/\\]+$/, '') === normHarnessPath);
      if (found) {
        matchedRepoPath = found.path;
      }
    }

    // 2. Persisted manual association
    if (!matchedRepoPath && sourceAssociations) {
      for (const [repoPath, associatedIds] of Object.entries(sourceAssociations)) {
        if (
          Array.isArray(associatedIds) &&
          (associatedIds.includes(harness.sourceId) || (harness.sessionId && associatedIds.includes(harness.sessionId)))
        ) {
          matchedRepoPath = repoPath;
          break;
        }
      }
    }

    // 3. Exact normalized project name (ONLY if completely unambiguous across all repos)
    if (!matchedRepoPath && harness.externalProjectName) {
      const normName = harness.externalProjectName.trim().toLowerCase();
      if (nameCounts.get(normName) === 1) {
        const found = repositories.find((r) => r.name.trim().toLowerCase() === normName);
        if (found) {
          matchedRepoPath = found.path;
        }
      }
    }

    if (matchedRepoPath && result.has(matchedRepoPath)) {
      result.get(matchedRepoPath)!.push(harness);
    }
  }

  // Sort each repository's harness activities by latest meaningful user activity
  for (const [path, list] of result.entries()) {
    result.set(path, orderHarnessActivities(list));
  }

  return result;
}

/**
 * Formats a concise harness summary for dashboard rows and project detail views.
 * If user interaction was '.', displays 'Previous result acknowledged' instead of '.'
 */
export function formatHarnessSummary(harness: HarnessActivity): {
  sourceName: string;
  relativeTime: string;
  statusLabel: string;
  previewText?: string;
} {
  const relativeTime = harness.lastUserInteractionAt
    ? formatRelativeTime(harness.lastUserInteractionAt)
    : 'Unknown';

  if (harness.lastUserInteractionType === 'ack') {
    return {
      sourceName: harness.displayName,
      relativeTime,
      statusLabel: 'Previous result acknowledged',
    };
  }

  if (harness.lastUserInteractionType === 'prompt' && harness.lastUserText) {
    const truncated =
      harness.lastUserText.length > 55
        ? `${harness.lastUserText.slice(0, 52)}...`
        : harness.lastUserText;
    return {
      sourceName: harness.displayName,
      relativeTime,
      statusLabel: 'Prompt submitted',
      previewText: truncated,
    };
  }

  return {
    sourceName: harness.displayName,
    relativeTime,
    statusLabel: harness.lastUserText || 'Active',
  };
}
