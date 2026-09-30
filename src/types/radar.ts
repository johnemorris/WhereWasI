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

export type ActivitySourceType =
  | 'git'
  | 'codex'
  | 'chatgpt'
  | 'claude'
  | 'antigravity';

export interface ProjectActivitySource {
  id: string;
  type: ActivitySourceType;
  displayName: string;
}

export interface HarnessActivity {
  sourceId: string;
  sourceType: ActivitySourceType;
  displayName: string;
  projectPath?: string;
  externalProjectName?: string;
  sessionId?: string;
  sessionTitle?: string;
  lastUserInteractionAt?: string;
  lastAgentInteractionAt?: string;
  lastUserInteractionType?: 'prompt' | 'message' | 'ack';
  lastUserText?: string;
  hasAgentResponseAfterLastUserInteraction?: boolean;
}

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
  harnessActivities?: HarnessActivity[];
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
  sourceAssociations?: Record<string, string[]>;
}

export interface ScanResult {
  projects: RepositoryState[];
  scanRoots: string[];
  errors: Array<{ path: string; message: string }>;
  scannedAt: string;
}
