import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import type { GitCommit, RepositoryState } from '../src/types/radar.js';
import {
  classifyAttention,
  computeSinceLastLooked,
  formatRelativeTime,
  parsePorcelainV2,
} from '../src/lib/radar-core.js';
import { storage } from './storage.js';

const execFileAsync = promisify(execFile);

/**
 * Checks if a given directory is a Git repository root.
 */
export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitPath = path.join(dirPath, '.git');
    const stat = await fs.stat(gitPath);
    return stat.isDirectory() || stat.isFile(); // file in worktrees/submodules
  } catch {
    return false;
  }
}

/**
 * Safely executes git command with an argument array (strictly read-only).
 */
async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoPath,
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      LC_ALL: 'C',
    },
  });
  return stdout;
}

/**
 * Retrieves deterministic state for a Git repository.
 */
export async function getRepositoryState(
  repoPath: string,
  rootPath: string
): Promise<RepositoryState> {
  const resolvedPath = path.resolve(repoPath);
  const repoName = path.basename(resolvedPath);
  const config = await storage.getConfig();
  const nextNoteObj = config.nextNotes[resolvedPath];
  const nextNote = nextNoteObj ? nextNoteObj.text : null;
  const nextUpdatedAt = nextNoteObj ? nextNoteObj.updatedAt : null;
  const lastSeen = config.lastSeen[resolvedPath] || null;

  try {
    // 1. Git status porcelain v2
    const statusOutput = await runGit(resolvedPath, [
      'status',
      '--porcelain=v2',
      '--branch',
      '--show-stash',
    ]);
    const parsed = parsePorcelainV2(statusOutput);

    // 2. Git log (recent 10 commits)
    const recentCommits: GitCommit[] = [];
    let headMessage = '';
    let headAuthor = '';
    let headCommitDate = '';

    try {
      const logOutput = await runGit(resolvedPath, [
        'log',
        '-n',
        '10',
        '--format=%h%x09%an%x09%aI%x09%s',
      ]);
      const lines = logOutput.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const [sha, author, date, message] = line.split('\t');
        if (sha) {
          recentCommits.push({
            sha,
            author: author || 'Unknown',
            date: date || '',
            message: message || '',
          });
        }
      }

      if (recentCommits.length > 0) {
        headMessage = recentCommits[0].message;
        headAuthor = recentCommits[0].author;
        headCommitDate = recentCommits[0].date;
      }
    } catch {
      // Repos with 0 commits or initial commit state
      headMessage = '(no commits yet)';
    }

    // 3. Conservative last activity calculation:
    // Start with latest commit date. If there are modified files, check their mtime.
    let latestActivityTime = headCommitDate ? new Date(headCommitDate).getTime() : 0;

    if (parsed.changedFiles.length > 0) {
      // Check mtimes of up to 10 changed files safely
      for (const file of parsed.changedFiles.slice(0, 10)) {
        try {
          const filePath = path.join(resolvedPath, file.path);
          const fstat = await fs.stat(filePath);
          if (fstat.mtimeMs > latestActivityTime) {
            latestActivityTime = fstat.mtimeMs;
          }
        } catch {
          // File might be deleted or inaccessible
        }
      }
    }

    const lastActivity = latestActivityTime > 0 ? new Date(latestActivityTime).toISOString() : '';
    const lastActivityRelative = formatRelativeTime(lastActivity);

    const isClean =
      parsed.modifiedCount === 0 &&
      parsed.stagedCount === 0 &&
      parsed.untrackedCount === 0 &&
      parsed.deletedCount === 0 &&
      parsed.conflictedCount === 0;

    // 4. Attention classification
    const { group, reasons } = classifyAttention(
      {
        isClean,
        modifiedCount: parsed.modifiedCount,
        stagedCount: parsed.stagedCount,
        untrackedCount: parsed.untrackedCount,
        deletedCount: parsed.deletedCount,
        conflictedCount: parsed.conflictedCount,
        stashCount: parsed.stashCount,
        lastActivity,
      },
      nextNote,
      config.idleThresholdDays
    );

    // 5. Since you last looked delta
    const sinceLastLooked = computeSinceLastLooked(
      {
        headSha: parsed.headSha,
        branch: parsed.branch,
        isClean,
        modifiedCount: parsed.modifiedCount,
        stagedCount: parsed.stagedCount,
        untrackedCount: parsed.untrackedCount,
        recentCommits,
      },
      lastSeen
    );

    return {
      id: Buffer.from(resolvedPath).toString('base64url'),
      name: repoName,
      path: resolvedPath,
      rootPath: path.resolve(rootPath),
      currentBranch: parsed.branch,
      isDetached: parsed.isDetached,
      isClean,
      stagedCount: parsed.stagedCount,
      modifiedCount: parsed.modifiedCount,
      untrackedCount: parsed.untrackedCount,
      deletedCount: parsed.deletedCount,
      conflictedCount: parsed.conflictedCount,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      stashCount: parsed.stashCount,
      headSha: parsed.headSha,
      headMessage,
      headCommitDate,
      headAuthor,
      lastActivity,
      lastActivityRelative,
      recentCommits,
      changedFiles: parsed.changedFiles,
      attentionGroup: group,
      needsMeReasons: reasons,
      next: nextNote,
      nextUpdatedAt,
      lastSeen,
      sinceLastLooked,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      id: Buffer.from(resolvedPath).toString('base64url'),
      name: repoName,
      path: resolvedPath,
      rootPath: path.resolve(rootPath),
      currentBranch: 'unknown',
      isDetached: false,
      isClean: true,
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      deletedCount: 0,
      conflictedCount: 0,
      upstream: null,
      ahead: 0,
      behind: 0,
      stashCount: 0,
      headSha: '',
      headMessage: '',
      headCommitDate: '',
      headAuthor: '',
      lastActivity: '',
      lastActivityRelative: 'Unknown',
      recentCommits: [],
      changedFiles: [],
      attentionGroup: 'IDLE',
      needsMeReasons: [],
      next: nextNote,
      nextUpdatedAt,
      lastSeen,
      sinceLastLooked: [],
      error: `Git error: ${errorMsg}`,
    };
  }
}
