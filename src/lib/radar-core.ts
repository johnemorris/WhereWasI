import type {
  AttentionGroup,
  GitChangedFile,
  LastSeenState,
  RepositoryState,
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
      `${repo.conflictedCount} conflicted ${repo.conflictedCount === 1 ? 'file' : 'files'}`
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
