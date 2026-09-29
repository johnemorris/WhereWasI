import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { RadarConfig, LastSeenState } from '../src/types/radar.js';

const STORAGE_DIR = process.env.RADAR_HOME || path.join(os.homedir(), '.agent-radar');
const CONFIG_FILE = path.join(STORAGE_DIR, 'radar-config.json');

const DEFAULT_CONFIG: RadarConfig = {
  scanRoots: [],
  ignoredPaths: [],
  idleThresholdDays: 7,
  nextNotes: {},
  lastSeen: {},
};

export class RadarStorage {
  private config: RadarConfig = { ...DEFAULT_CONFIG };
  private initialized = false;

  async init(): Promise<RadarConfig> {
    if (this.initialized) return this.config;

    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch {
      // ignore
    }

    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      // Create fresh default config
      this.config = { ...DEFAULT_CONFIG };
      await this.save();
    }

    this.initialized = true;
    return this.config;
  }

  async getConfig(): Promise<RadarConfig> {
    await this.init();
    return this.config;
  }

  async save(): Promise<void> {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write radar-config.json:', err);
    }
  }

  async addScanRoot(rootPath: string): Promise<string[]> {
    await this.init();
    const resolved = path.resolve(rootPath);
    if (!this.config.scanRoots.includes(resolved)) {
      this.config.scanRoots.push(resolved);
      await this.save();
    }
    return this.config.scanRoots;
  }

  async removeScanRoot(rootPath: string): Promise<string[]> {
    await this.init();
    const resolved = path.resolve(rootPath);
    this.config.scanRoots = this.config.scanRoots.filter((r) => r !== resolved);
    await this.save();
    return this.config.scanRoots;
  }

  async setNextNote(repoPath: string, text: string): Promise<void> {
    await this.init();
    const resolved = path.resolve(repoPath);
    const trimmed = text.trim();
    if (!trimmed) {
      delete this.config.nextNotes[resolved];
    } else {
      this.config.nextNotes[resolved] = {
        text: trimmed,
        updatedAt: new Date().toISOString(),
      };
    }
    await this.save();
  }

  async setLastSeen(repoPath: string, state: LastSeenState): Promise<void> {
    await this.init();
    const resolved = path.resolve(repoPath);
    this.config.lastSeen[resolved] = state;
    await this.save();
  }

  async toggleIgnore(repoPath: string): Promise<string[]> {
    await this.init();
    const resolved = path.resolve(repoPath);
    if (this.config.ignoredPaths.includes(resolved)) {
      this.config.ignoredPaths = this.config.ignoredPaths.filter((p) => p !== resolved);
    } else {
      this.config.ignoredPaths.push(resolved);
    }
    await this.save();
    return this.config.ignoredPaths;
  }

  async setIdleThreshold(days: number): Promise<number> {
    await this.init();
    this.config.idleThresholdDays = Math.max(1, Math.min(365, days));
    await this.save();
    return this.config.idleThresholdDays;
  }
}

export const storage = new RadarStorage();
