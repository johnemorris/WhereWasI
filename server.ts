import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { scanAllRepositories } from './server/discovery.js';
import { storage } from './server/storage.js';
import { ensureSampleRepositories } from './server/sample-repos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// API Endpoints

// 1. Get scan results for all repositories
app.get('/api/scan', async (_req, res) => {
  try {
    const result = await scanAllRepositories();
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 2. Get current configuration
app.get('/api/config', async (_req, res) => {
  try {
    const config = await storage.getConfig();
    res.json(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 3. Add a scan root
app.post('/api/scan-roots', async (req, res) => {
  try {
    const rootPath = req.body?.path;
    if (!rootPath || typeof rootPath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }
    const resolved = path.resolve(rootPath);
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Provided path is not a directory' });
      }
    } catch {
      return res.status(400).json({ error: `Directory does not exist: ${resolved}` });
    }

    const roots = await storage.addScanRoot(resolved);
    res.json({ success: true, roots });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 4. Remove a scan root
app.delete('/api/scan-roots', async (req, res) => {
  try {
    const rootPath = req.body?.path;
    if (!rootPath || typeof rootPath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }
    const roots = await storage.removeScanRoot(rootPath);
    res.json({ success: true, roots });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 5. Update NEXT note
app.post('/api/next', async (req, res) => {
  try {
    const { path: repoPath, text } = req.body;
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }
    await storage.setNextNote(repoPath, text ?? '');
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 6. Record last-seen baseline
app.post('/api/last-seen', async (req, res) => {
  try {
    const { path: repoPath, state } = req.body;
    if (!repoPath || !state) {
      return res.status(400).json({ error: 'Path and state are required' });
    }
    await storage.setLastSeen(repoPath, state);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 7. Toggle ignore repository
app.post('/api/ignore', async (req, res) => {
  try {
    const { path: repoPath } = req.body;
    if (!repoPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const ignored = await storage.toggleIgnore(repoPath);
    res.json({ success: true, ignored });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 8. Set idle threshold
app.post('/api/settings/idle-threshold', async (req, res) => {
  try {
    const { days } = req.body;
    const val = await storage.setIdleThreshold(parseInt(days, 10) || 7);
    res.json({ success: true, idleThresholdDays: val });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 9. Seed/ensure dogfood sample repos
app.post('/api/seed-samples', async (_req, res) => {
  try {
    const sampleDir = await ensureSampleRepositories();
    res.json({ success: true, sampleDir });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 10. Local directory browser helper (for quick path selection)
app.get('/api/fs/browse', async (req, res) => {
  try {
    const targetDir = (req.query.path as string) || process.cwd();
    const resolved = path.resolve(targetDir);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const directories = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => ({
        name: e.name,
        path: path.join(resolved, e.name),
      }));

    res.json({
      current: resolved,
      parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      directories,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 11. Export as ZIP archive (works anywhere, including mobile browsers)
app.get('/api/export/zip', async (_req, res) => {
  try {
    const zipPath = path.resolve('/tmp/where-was-i.zip');
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    await execFileAsync('git', ['archive', '--format=zip', '-o', zipPath, 'HEAD'], {
      cwd: process.cwd(),
    });

    res.download(zipPath, 'where-was-i.zip');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to create ZIP: ${msg}` });
  }
});

// 12. Push directly to new private GitHub repository via Personal Access Token
app.post('/api/export/github', async (req, res) => {
  try {
    const { token, repoName = 'where-was-i', isPrivate = true } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'GitHub Personal Access Token is required' });
    }

    const cleanToken = token.trim();
    const cleanRepoName = (repoName || 'where-was-i')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');

    // 1. Get authenticated user login from GitHub API
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Agent-Project-Radar',
      },
    });

    if (!userRes.ok) {
      const errBody = await userRes.text();
      return res.status(401).json({
        error: `GitHub authentication failed. Please verify your token permissions. (${errBody})`,
      });
    }

    const userData = (await userRes.json()) as { login: string };
    const username = userData.login;

    // 2. Create repository via GitHub API (or check if already exists)
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Agent-Project-Radar',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanRepoName,
        private: isPrivate !== false,
        description: 'Agent Project Radar prototype (where-was-i)',
      }),
    });

    if (!createRes.ok && createRes.status !== 422) {
      // 422 usually means repository already exists in user account
      const errText = await createRes.text();
      return res.status(400).json({ error: `Failed to create repository: ${errText}` });
    }

    // 3. Push local git repository to GitHub
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const authedUrl = `https://x-access-token:${cleanToken}@github.com/${username}/${cleanRepoName}.git`;
    const cleanUrl = `https://github.com/${username}/${cleanRepoName}.git`;

    try {
      // Remove existing remote if any
      await execFileAsync('git', ['remote', 'remove', 'origin'], { cwd: process.cwd() }).catch(
        () => {}
      );
      await execFileAsync('git', ['remote', 'add', 'origin', authedUrl], { cwd: process.cwd() });
      await execFileAsync('git', ['branch', '-M', 'main'], { cwd: process.cwd() });
      await execFileAsync('git', ['push', '-u', 'origin', 'main', '--force'], {
        cwd: process.cwd(),
      });
    } finally {
      // Sanitize remote URL so the token is never stored on disk
      await execFileAsync('git', ['remote', 'set-url', 'origin', cleanUrl], {
        cwd: process.cwd(),
      }).catch(() => {});
    }

    res.json({
      success: true,
      repoUrl: `https://github.com/${username}/${cleanRepoName}`,
      message: `Successfully pushed to https://github.com/${username}/${cleanRepoName}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

async function startServer() {
  // Ensure dogfood sample repos are ready on startup
  try {
    await ensureSampleRepositories();
  } catch (err) {
    console.warn('Notice: Sample repos initialization skipped:', err);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Agent Project Radar running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
