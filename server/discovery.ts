import fs from 'fs/promises';
import path from 'path';
import { isGitRepo, getRepositoryState } from './git.js';
import { storage } from './storage.js';
import { loadAllCodexSessions } from './codex-source.js';
import { associateHarnessesToRepositories } from '../src/lib/radar-core.js';
import type { RepositoryState, ScanResult } from '../src/types/radar.js';

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'target',
  '.cargo',
  'vendor',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  '.cache',
  'bower_components',
]);

const MAX_SCAN_DEPTH = 3;
const SCAN_CONCURRENCY = 4;

/**
 * Discovers Git repositories under a root directory up to MAX_SCAN_DEPTH.
 */
async function discoverInDirectory(
  currentDir: string,
  rootPath: string,
  depth: number,
  foundRepos: Map<string, string> // realPath -> rootPath
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;

  try {
    // If current directory itself is a Git repository, record it and stop descending into it!
    const isRepo = await isGitRepo(currentDir);
    if (isRepo) {
      const real = await fs.realpath(currentDir).catch(() => path.resolve(currentDir));
      foundRepos.set(real, rootPath);
      return;
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.radar') continue; // skip hidden dirs

      const childDir = path.join(currentDir, entry.name);
      await discoverInDirectory(childDir, rootPath, depth + 1, foundRepos);
    }
  } catch {
    // Inaccessible directory, permissions error, or disappeared path: skip gracefully
  }
}

/**
 * Concurrently processes an array of items with a concurrency limit.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        // Handled inside fn
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Scans all configured roots and returns repository states.
 */
export async function scanAllRepositories(): Promise<ScanResult> {
  const config = await storage.getConfig();
  const repoMap = new Map<string, string>(); // repoPath -> rootPath
  const errors: Array<{ path: string; message: string }> = [];

  for (const root of config.scanRoots) {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) {
        errors.push({ path: root, message: 'Scan root is not a directory' });
        continue;
      }
      await discoverInDirectory(root, root, 0, repoMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ path: root, message: `Cannot access scan root: ${msg}` });
    }
  }

  // Filter out ignored paths
  const ignoredSet = new Set(config.ignoredPaths.map((p) => path.resolve(p)));
  const targetRepos = Array.from(repoMap.entries())
    .map(([repoPath, rootPath]) => ({ repoPath, rootPath }))
    .filter((r) => !ignoredSet.has(path.resolve(r.repoPath)));

  // Concurrently inspect Git state
  const projects = await mapConcurrent(
    targetRepos,
    SCAN_CONCURRENCY,
    async ({ repoPath, rootPath }) => {
      return await getRepositoryState(repoPath, rootPath);
    }
  );

  // Filter out any undefined slots if errors occurred
  const validProjects = projects.filter((p): p is RepositoryState => Boolean(p));

  // Load and associate Codex & harness activities
  try {
    const codexSessions = await loadAllCodexSessions(validProjects.map((p) => p.path));
    if (codexSessions.length > 0) {
      const associatedMap = associateHarnessesToRepositories(
        validProjects.map((p) => ({ path: p.path, name: p.name })),
        codexSessions,
        config.sourceAssociations
      );
      for (const p of validProjects) {
        const activities = associatedMap.get(p.path);
        if (activities && activities.length > 0) {
          p.harnessActivities = activities;
        }
      }
    }
  } catch (err) {
    console.warn('Notice: Harness activities discovery skipped:', err);
  }

  // Sort projects: NEEDS_ME first, then RECENTLY_ACTIVE, then IDLE. Within group, most recent first.
  validProjects.sort((a, b) => {
    const groupRank: Record<RepositoryState['attentionGroup'], number> = {
      NEEDS_ME: 0,
      RECENTLY_ACTIVE: 1,
      IDLE: 2,
    };

    if (groupRank[a.attentionGroup] !== groupRank[b.attentionGroup]) {
      return groupRank[a.attentionGroup] - groupRank[b.attentionGroup];
    }

    const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return timeB - timeA;
  });

  return {
    projects: validProjects,
    scanRoots: config.scanRoots,
    errors,
    scannedAt: new Date().toISOString(),
  };
}
