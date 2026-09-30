import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { storage } from './storage.js';

const execFileAsync = promisify(execFile);

async function runCmd(cmd: string, args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, { cwd });
  return stdout;
}

export async function ensureSampleRepositories(): Promise<string> {
  const sampleDir = path.resolve(process.cwd(), 'sample_repos');
  try {
    await fs.mkdir(sampleDir, { recursive: true });
  } catch {
    // ignore
  }

  // 1. FederalRegisterDigest
  const repo1 = path.join(sampleDir, 'FederalRegisterDigest');
  try {
    await fs.stat(path.join(repo1, '.git'));
  } catch {
    await fs.mkdir(path.join(repo1, 'src/collector'), { recursive: true });
    await fs.mkdir(path.join(repo1, 'reports'), { recursive: true });
    await fs.writeFile(
      path.join(repo1, 'README.md'),
      '# Federal Register Digest\n\nAutomated tracking for federal agency notices.\n'
    );
    await fs.writeFile(
      path.join(repo1, 'src/collector/golden.ts'),
      'export const goldenRules = { retentionDays: 90 };\n'
    );
    await runCmd('git', ['init', '-b', 'main'], repo1);
    await runCmd('git', ['config', 'user.name', 'Dev User'], repo1);
    await runCmd('git', ['config', 'user.email', 'dev@example.com'], repo1);
    await runCmd('git', ['add', '.'], repo1);
    await runCmd('git', ['commit', '-m', 'Initial commit for Federal Register Digest'], repo1);

    await runCmd('git', ['checkout', '-b', 'feature/source-retention'], repo1);
    await fs.writeFile(
      path.join(repo1, 'src/collector/golden.ts'),
      'export const goldenRules = { retentionDays: 180, auditTrail: true };\n'
    );
    await runCmd('git', ['commit', '-am', 'Add collection golden tests'], repo1);

    // Make it dirty with uncommitted work
    await fs.appendFile(
      path.join(repo1, 'src/collector/golden.ts'),
      '// Uncommitted Phase 1 retention work\nexport const pendingPhase = 1;\n'
    );
    await fs.writeFile(
      path.join(repo1, 'src/collector/retention.ts'),
      '// Retention policy staging\n'
    );
    await fs.writeFile(
      path.join(repo1, 'reports/audit_phase0.md'),
      '# Phase 0 Audit Notes\nAll criteria verified.\n'
    );

    await storage.setNextNote(
      repo1,
      'Implement Phase 1 retention after reviewing the Phase 0 report.'
    );
  }

  // 2. LOWBI
  const repo2 = path.join(sampleDir, 'LOWBI');
  try {
    await fs.stat(path.join(repo2, '.git'));
  } catch {
    await fs.mkdir(path.join(repo2, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(repo2, 'package.json'),
      '{\n  "name": "lowbi",\n  "version": "1.0.0"\n}\n'
    );
    await fs.writeFile(
      path.join(repo2, 'src/lifecycle.ts'),
      'export function getLifecycle() { return "business-v1"; }\n'
    );
    await runCmd('git', ['init', '-b', 'main'], repo2);
    await runCmd('git', ['config', 'user.name', 'Dev User'], repo2);
    await runCmd('git', ['config', 'user.email', 'dev@example.com'], repo2);
    await runCmd('git', ['add', '.'], repo2);
    await runCmd('git', ['commit', '-m', 'Base architecture'], repo2);

    await runCmd('git', ['checkout', '-b', 'fix/business-project-lifecycle'], repo2);
    await fs.writeFile(
      path.join(repo2, 'src/lifecycle.ts'),
      'export function getLifecycle() { return "business-v2-active"; }\n'
    );
    // Commit with an older date (5 days ago)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    await execFileAsync('git', ['commit', '-am', 'Fix lifecycle hooks and transitions'], {
      cwd: repo2,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: fiveDaysAgo,
        GIT_COMMITTER_DATE: fiveDaysAgo,
      },
    });

    await storage.setNextNote(
      repo2,
      'Continue commercial-cleaning opportunity work.'
    );
  }

  // 3. FindWPHost
  const repo3 = path.join(sampleDir, 'FindWPHost');
  try {
    await fs.stat(path.join(repo3, '.git'));
  } catch {
    await fs.mkdir(path.join(repo3, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo3, 'README.md'), '# FindWPHost\n');
    await runCmd('git', ['init', '-b', 'main'], repo3);
    await runCmd('git', ['config', 'user.name', 'Dev User'], repo3);
    await runCmd('git', ['config', 'user.email', 'dev@example.com'], repo3);
    await runCmd('git', ['add', '.'], repo3);
    await runCmd('git', ['commit', '-m', 'Init hosting comparison index'], repo3);

    await fs.writeFile(
      path.join(repo3, 'src/comparator.ts'),
      'export function compareHosts() { return []; }\n'
    );
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    await execFileAsync('git', ['add', '.'], { cwd: repo3 });
    await execFileAsync('git', ['commit', '-m', 'Add comparison selector scaffolding'], {
      cwd: repo3,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: twoDaysAgo,
        GIT_COMMITTER_DATE: twoDaysAgo,
      },
    });

    // Create a stash
    await fs.appendFile(path.join(repo3, 'src/comparator.ts'), '// Stashed experiment\n');
    await runCmd('git', ['stash', 'push', '-m', 'WIP: speed benchmark comparisons'], repo3);

    // Make 1 unstaged edit
    await fs.appendFile(path.join(repo3, 'README.md'), '\n## Provider Benchmarks\n');

    await storage.setNextNote(repo3, 'Finish comparison selector/refactor review.');
  }

  // 4. UniversalBoard (Idle, 25 days ago)
  const repo4 = path.join(sampleDir, 'UniversalBoard');
  try {
    await fs.stat(path.join(repo4, '.git'));
  } catch {
    await fs.mkdir(path.join(repo4, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo4, 'index.html'), '<div id="board"></div>\n');
    await runCmd('git', ['init', '-b', 'main'], repo4);
    await runCmd('git', ['config', 'user.name', 'Dev User'], repo4);
    await runCmd('git', ['config', 'user.email', 'dev@example.com'], repo4);
    await runCmd('git', ['add', '.'], repo4);

    const oldDate = new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString();
    await execFileAsync('git', ['commit', '-m', 'Initial canvas layout and board wireframe'], {
      cwd: repo4,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: oldDate,
        GIT_COMMITTER_DATE: oldDate,
      },
    });
  }

  // 5. RunawayIntelligence-News (Clean working tree + 1 stash, branch feat/rotating-event-horizon-v2, no NEXT)
  const repo5 = path.join(sampleDir, 'RunawayIntelligence-News');
  try {
    await fs.stat(path.join(repo5, '.git'));
  } catch {
    await fs.mkdir(path.join(repo5, 'src/shaders'), { recursive: true });
    await fs.writeFile(
      path.join(repo5, 'README.md'),
      '# RunawayIntelligence-News\n\nDaily machine intelligence visualization dispatch.\n'
    );
    await fs.writeFile(
      path.join(repo5, 'src/shaders/horizon.glsl'),
      '// Event horizon shader\nvoid main() {}\n'
    );
    await runCmd('git', ['init', '-b', 'main'], repo5);
    await runCmd('git', ['config', 'user.name', 'Dev User'], repo5);
    await runCmd('git', ['config', 'user.email', 'dev@example.com'], repo5);
    await runCmd('git', ['add', '.'], repo5);

    const baseDate = '2026-09-20T10:00:00Z';
    await execFileAsync('git', ['commit', '-m', 'Initial news layout and space assets'], {
      cwd: repo5,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: baseDate,
        GIT_COMMITTER_DATE: baseDate,
      },
    });

    await runCmd('git', ['checkout', '-b', 'feat/rotating-event-horizon-v2'], repo5);
    await fs.writeFile(
      path.join(repo5, 'src/shaders/earth.glsl'),
      '// Earth rotation and lighting\nuniform float uTime;\n'
    );
    const date2 = '2026-09-22T14:00:00Z';
    await execFileAsync('git', ['add', '.'], { cwd: repo5 });
    await execFileAsync('git', ['commit', '-m', 'Add Earth rotation, lighting, and compositing'], {
      cwd: repo5,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: date2,
        GIT_COMMITTER_DATE: date2,
      },
    });

    await fs.appendFile(
      path.join(repo5, 'src/shaders/horizon.glsl'),
      '// Gravitational lensing calculations\n'
    );
    const date3 = '2026-09-24T16:45:00Z';
    await execFileAsync('git', ['commit', '-am', 'Refine event horizon rotation geometry'], {
      cwd: repo5,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: date3,
        GIT_COMMITTER_DATE: date3,
      },
    });

    // Create a stash and leave working tree 100% clean
    await fs.appendFile(path.join(repo5, 'src/shaders/horizon.glsl'), '// WIP: flare draft\n');
    await runCmd('git', ['stash', 'push', '-m', 'WIP: atmospheric lens flare pass'], repo5);
  }

  // Ensure sampleDir is registered as a scan root if no roots exist yet
  const config = await storage.getConfig();
  if (config.scanRoots.length === 0) {
    await storage.addScanRoot(sampleDir);
  }

  return sampleDir;
}
