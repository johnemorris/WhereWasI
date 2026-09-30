import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { HarnessActivity } from '../src/types/radar.js';
import { parseCodexSession } from '../src/lib/radar-core.js';

/**
 * Discovers and parses Codex session files locally.
 * Reads from standard workstation locations and repository-local .codex folders.
 * Read-only: never modifies or deletes any files.
 */
export async function loadAllCodexSessions(repoPaths: string[] = []): Promise<HarnessActivity[]> {
  const sessions: HarnessActivity[] = [];
  const visitedFiles = new Set<string>();

  // Candidate directories to inspect
  const searchDirs: string[] = [
    path.join(os.homedir(), '.codex', 'sessions'),
    path.join(os.homedir(), '.agent-radar', 'codex-sessions'),
  ];

  // Also inspect repository-local .codex/sessions if present
  for (const repoPath of repoPaths) {
    searchDirs.push(path.join(repoPath, '.codex', 'sessions'));
    searchDirs.push(path.join(repoPath, '.codex'));
  }

  for (const dir of searchDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        const fullPath = path.join(dir, entry.name);
        if (visitedFiles.has(fullPath)) continue;
        visitedFiles.add(fullPath);

        try {
          const rawText = await fs.readFile(fullPath, 'utf-8');
          const data = JSON.parse(rawText);
          const parsed = parseCodexSession(data, `codex-${entry.name.replace('.json', '')}`);
          if (parsed) {
            sessions.push(parsed);
          }
        } catch {
          // Skip invalid JSON safely
        }
      }
    } catch {
      // Directory doesn't exist or is inaccessible
    }
  }

  // Also check ~/.codex/history.jsonl if present
  const historyJsonlPath = path.join(os.homedir(), '.codex', 'history.jsonl');
  try {
    const lines = (await fs.readFile(historyJsonlPath, 'utf-8')).split('\n');
    let idx = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        const parsed = parseCodexSession(item, `codex-jsonl-${idx++}`);
        if (parsed) {
          sessions.push(parsed);
        }
      } catch {
        // Skip malformed line
      }
    }
  } catch {
    // No history.jsonl
  }

  return sessions;
}
