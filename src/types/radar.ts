export interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
}

export interface GitChangedFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
  rawStatus: string;
}

export interface LastSeenState {
  timestamp: string;
  headSha: string;
  branch: string;
  isClean: boolean;
  modifiedCount: number;
  stagedCount: number;
  untrackedCount: number;
}

export type AttentionGroup = 'NEEDS_ME' | 'RECENTLY_ACTIVE' | 'IDLE';

export interface RepositoryState {
  id: string;
  name: string;
  path: string;
  rootPath: string;
  currentBranch: string;
  isDetached: boolean;
  isClean: boolean;
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  deletedCount: number;
  conflictedCount: number;
  upstream: string | null;
  ahead: number;
  behind: number;
  stashCount: number;
  headSha: string;
  headMessage: string;
  headCommitDate: string;
  headAuthor: string;
  lastActivity: string;
  lastActivityRelative: string;
  recentCommits: GitCommit[];
  changedFiles: GitChangedFile[];
  attentionGroup: AttentionGroup;
  needsMeReasons: string[];
  dashboardEvidence?: string;
  next: string | null;
  nextUpdatedAt: string | null;
  lastSeen: LastSeenState | null;
  sinceLastLooked: string[];
  error?: string;
}

export interface RadarConfig {
  scanRoots: string[];
  ignoredPaths: string[];
  idleThresholdDays: number;
  nextNotes: Record<string, { text: string; updatedAt: string }>;
  lastSeen: Record<string, LastSeenState>;
}

export interface ScanResult {
  projects: RepositoryState[];
  scanRoots: string[];
  errors: Array<{ path: string; message: string }>;
  scannedAt: string;
}
