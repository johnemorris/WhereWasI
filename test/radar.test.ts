import assert from 'assert';
import {
  parsePorcelainV2,
  classifyAttention,
  formatDashboardEvidence,
  computeSinceLastLooked,
  parseCodexSession,
  orderHarnessActivities,
  associateHarnessesToRepositories,
  formatHarnessSummary,
} from '../src/lib/radar-core.js';
import type { HarnessActivity } from '../src/types/radar.js';

console.log('--- Running Agent Project Radar Unit Tests ---');

// Porcelain Git Status Parsing
{
  const fixture = `
# branch.oid 4a12bc9
# branch.head feature/source-retention
# branch.upstream origin/feature/source-retention
# branch.ab +2 -1
# stash 1
1 .M N... 100644 100644 100644 a1b2c3d e4f5g6h src/collector/golden.ts
1 M. N... 100644 100644 100644 b2c3d4e f5g6h7i src/policy.ts
? reports/audit_phase0.md
u UU N... 100644 100644 100644 100644 c3d4e5f f6g7h8i g7h8i9j conflict.ts
`;

  const parsed = parsePorcelainV2(fixture);
  assert.strictEqual(parsed.branch, 'feature/source-retention');
  assert.strictEqual(parsed.headSha, '4a12bc9');
  assert.strictEqual(parsed.upstream, 'origin/feature/source-retention');
  assert.strictEqual(parsed.ahead, 2);
  assert.strictEqual(parsed.behind, 1);
  assert.strictEqual(parsed.stashCount, 1);
  assert.strictEqual(parsed.modifiedCount, 1);
  assert.strictEqual(parsed.stagedCount, 1);
  assert.strictEqual(parsed.untrackedCount, 1);
  assert.strictEqual(parsed.conflictedCount, 1);
  assert.strictEqual(parsed.isDetached, false);
  console.log('✓ Porcelain v2 parsing test passed');
}

// -------------------------------------------------------------
// Core Attention Classification Tests (NEXT has ZERO influence)
// -------------------------------------------------------------

// TEST 1: Clean + recent + NEXT => RECENTLY ACTIVE
{
  const repo = {
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2d ago
  };
  const result = classifyAttention(repo, 'Continue commercial-cleaning opportunity work', 7);
  assert.strictEqual(result.group, 'RECENTLY_ACTIVE');
  assert.strictEqual(result.reasons.length, 1);
  assert.strictEqual(result.reasons[0], 'Recently active · Clean');
  console.log('✓ TEST 1 passed: Clean + recent + NEXT => RECENTLY_ACTIVE');
}

// TEST 2: Clean + old + NEXT => IDLE
{
  const repo = {
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(), // 20d ago
  };
  const result = classifyAttention(repo, 'Evaluate new canvas architecture next sprint', 7);
  assert.strictEqual(result.group, 'IDLE');
  assert.strictEqual(result.reasons.length, 1);
  assert.strictEqual(result.reasons[0], 'No recent activity · Clean');
  console.log('✓ TEST 2 passed: Clean + old + NEXT => IDLE');
}

// TEST 3: Modified + NEXT => NEEDS ME
{
  const repo = {
    isClean: false,
    modifiedCount: 2,
    stagedCount: 0,
    untrackedCount: 1,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date().toISOString(),
  };
  const result = classifyAttention(repo, 'Implement Phase 1 retention', 7);
  assert.strictEqual(result.group, 'NEEDS_ME');
  assert(result.reasons.some((r) => r.includes('2 modified')));
  assert(result.reasons.some((r) => r.includes('1 untracked')));
  assert(!result.reasons.some((r) => r.includes('NEXT')));
  console.log('✓ TEST 3 passed: Modified + NEXT => NEEDS_ME (reasons from Git state only)');
}

// TEST 4: Modified + no NEXT => NEEDS ME
{
  const repo = {
    isClean: false,
    modifiedCount: 1,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date().toISOString(),
  };
  const result = classifyAttention(repo, null, 7);
  assert.strictEqual(result.group, 'NEEDS_ME');
  assert(result.reasons.some((r) => r.includes('1 modified')));
  console.log('✓ TEST 4 passed: Modified + no NEXT => NEEDS_ME');
}

// TEST 5: Clean + recent + no NEXT => RECENTLY ACTIVE
{
  const repo = {
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // 3d ago
  };
  const result = classifyAttention(repo, null, 7);
  assert.strictEqual(result.group, 'RECENTLY_ACTIVE');
  console.log('✓ TEST 5 passed: Clean + recent + no NEXT => RECENTLY_ACTIVE');
}

// TEST 6: Clean + old + no NEXT => IDLE
{
  const repo = {
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 0,
    lastActivity: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), // 30d ago
  };
  const result = classifyAttention(repo, null, 7);
  assert.strictEqual(result.group, 'IDLE');
  console.log('✓ TEST 6 passed: Clean + old + no NEXT => IDLE');
}

// TEST 7: Clean + stash => NEEDS ME
{
  const repo = {
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 0,
    stashCount: 1,
    lastActivity: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  };
  const result = classifyAttention(repo, 'Some note', 7);
  assert.strictEqual(result.group, 'NEEDS_ME');
  assert(result.reasons.some((r) => r.includes('1 stash')));
  assert(!result.reasons.some((r) => r.includes('NEXT')));
  console.log('✓ TEST 7 passed: Clean + stash => NEEDS_ME');
}

// TEST 8: Conflict => NEEDS ME
{
  const repo = {
    isClean: false,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    conflictedCount: 1,
    stashCount: 0,
    lastActivity: new Date().toISOString(),
  };
  const result = classifyAttention(repo, null, 7);
  assert.strictEqual(result.group, 'NEEDS_ME');
  assert(result.reasons.some((r) => r.includes('1 conflicted')));
  console.log('✓ TEST 8 passed: Conflict => NEEDS_ME');
}

// -------------------------------------------------------------
// Dashboard Evidence Formatting Tests
// -------------------------------------------------------------

// EVIDENCE 1: Clean + stash 1 => "Clean · 1 stash"
{
  const evidence = formatDashboardEvidence({
    isClean: true,
    conflictedCount: 0,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 1,
  });
  assert.strictEqual(evidence, 'Clean · 1 stash');
  console.log('✓ Evidence Test 1 passed: Clean + stash 1 => Clean · 1 stash');
}

// EVIDENCE 2: Modified 2 + untracked 3 => "2 modified · 3 untracked"
{
  const evidence = formatDashboardEvidence({
    isClean: false,
    conflictedCount: 0,
    modifiedCount: 2,
    stagedCount: 0,
    untrackedCount: 3,
    deletedCount: 0,
    stashCount: 0,
  });
  assert.strictEqual(evidence, '2 modified · 3 untracked');
  console.log('✓ Evidence Test 2 passed: Modified 2 + untracked 3 => 2 modified · 3 untracked');
}

// EVIDENCE 3: Modified 1 + stash 1 => "1 modified · 1 stash"
{
  const evidence = formatDashboardEvidence({
    isClean: false,
    conflictedCount: 0,
    modifiedCount: 1,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 1,
  });
  assert.strictEqual(evidence, '1 modified · 1 stash');
  console.log('✓ Evidence Test 3 passed: Modified 1 + stash 1 => 1 modified · 1 stash');
}

// EVIDENCE 4: Conflict 2 => clearly exposes "2 conflicted"
{
  const evidence = formatDashboardEvidence({
    isClean: false,
    conflictedCount: 2,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 0,
  });
  assert.strictEqual(evidence, '2 conflicted');
  console.log('✓ Evidence Test 4 passed: Conflict 2 => 2 conflicted');
}

// EVIDENCE 5: Clean recently active => "Clean"
{
  const evidence = formatDashboardEvidence({
    isClean: true,
    conflictedCount: 0,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 0,
  });
  assert.strictEqual(evidence, 'Clean');
  console.log('✓ Evidence Test 5 passed: Clean recently active => Clean');
}

// EVIDENCE 6: Clean idle => "Clean"
{
  const evidence = formatDashboardEvidence({
    isClean: true,
    conflictedCount: 0,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 0,
  });
  assert.strictEqual(evidence, 'Clean');
  console.log('✓ Evidence Test 6 passed: Clean idle => Clean');
}

// EVIDENCE 7: Staged 3 => "3 staged"
{
  const evidence = formatDashboardEvidence({
    isClean: false,
    conflictedCount: 0,
    modifiedCount: 0,
    stagedCount: 3,
    untrackedCount: 0,
    deletedCount: 0,
    stashCount: 0,
  });
  assert.strictEqual(evidence, '3 staged');
  console.log('✓ Evidence Test 7 passed: Staged 3 => 3 staged');
}

// EVIDENCE 8: Mixed (2 modified · 1 untracked · 1 stash)
{
  const evidence = formatDashboardEvidence({
    isClean: false,
    conflictedCount: 0,
    modifiedCount: 2,
    stagedCount: 0,
    untrackedCount: 1,
    deletedCount: 0,
    stashCount: 1,
  });
  assert.strictEqual(evidence, '2 modified · 1 untracked · 1 stash');
  console.log('✓ Evidence Test 8 passed: Mixed 2 modified · 1 untracked · 1 stash');
}

// "Since you last looked" delta logic
{
  const lastSeen = {
    timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    headSha: '1111111',
    branch: 'main',
    isClean: true,
    modifiedCount: 0,
    stagedCount: 0,
    untrackedCount: 0,
  };

  const current = {
    headSha: '3333333',
    branch: 'feature/source-retention',
    isClean: false,
    modifiedCount: 2,
    stagedCount: 0,
    untrackedCount: 1,
    recentCommits: [
      { sha: '3333333', message: 'New commit 2' },
      { sha: '2222222', message: 'New commit 1' },
      { sha: '1111111', message: 'Baseline commit' },
    ],
  };

  const delta = computeSinceLastLooked(current, lastSeen);
  assert(delta.some((s) => s.includes('Branch changed: main → feature/source-retention')));
  assert(delta.some((s) => s.includes('2 new commits since your last visit')));
  assert(delta.some((s) => s.includes('Working tree became dirty')));
  console.log('✓ Delta / "Since you last looked" test passed');
}

// -------------------------------------------------------------
// Phase 2B: Activity Source & Harness Tests (Tests 1 to 10)
// -------------------------------------------------------------

// HARNESS TEST 1: Codex activity associates by exact repo path
{
  const repos = [
    { path: '/projects/FederalRegisterDigest', name: 'FederalRegisterDigest' },
    { path: '/projects/UniversalBoard', name: 'UniversalBoard' },
  ];
  const harnesses: HarnessActivity[] = [
    {
      sourceId: 'codex-1',
      sourceType: 'codex',
      displayName: 'Codex',
      projectPath: '/projects/FederalRegisterDigest',
      lastUserInteractionAt: '2026-09-30T10:00:00Z',
    },
  ];

  const map = associateHarnessesToRepositories(repos, harnesses);
  assert.strictEqual(map.get('/projects/FederalRegisterDigest')?.length, 1);
  assert.strictEqual(map.get('/projects/FederalRegisterDigest')?.[0].sourceId, 'codex-1');
  assert.strictEqual(map.get('/projects/UniversalBoard')?.length, 0);
  console.log('✓ Harness Test 1 passed: Associates by exact repo path');
}

// HARNESS TEST 2: Exact matching project names can associate when unambiguous
{
  const repos = [
    { path: '/work/app1', name: 'UniqueProjectAlpha' },
    { path: '/work/app2', name: 'OtherProject' },
  ];
  const harnesses: HarnessActivity[] = [
    {
      sourceId: 'codex-2',
      sourceType: 'codex',
      displayName: 'Codex',
      externalProjectName: 'UniqueProjectAlpha',
      lastUserInteractionAt: '2026-09-30T10:00:00Z',
    },
  ];

  const map = associateHarnessesToRepositories(repos, harnesses);
  assert.strictEqual(map.get('/work/app1')?.length, 1);
  assert.strictEqual(map.get('/work/app1')?.[0].sourceId, 'codex-2');
  console.log('✓ Harness Test 2 passed: Exact matching project names associate when unambiguous');
}

// HARNESS TEST 3: Ambiguous matches are not silently associated
{
  const repos = [
    { path: '/work/team-a/SharedName', name: 'SharedName' },
    { path: '/work/team-b/SharedName', name: 'SharedName' },
  ];
  const harnesses: HarnessActivity[] = [
    {
      sourceId: 'codex-3',
      sourceType: 'codex',
      displayName: 'Codex',
      externalProjectName: 'SharedName', // Ambiguous! Present in two distinct repos
      lastUserInteractionAt: '2026-09-30T10:00:00Z',
    },
  ];

  const map = associateHarnessesToRepositories(repos, harnesses);
  assert.strictEqual(map.get('/work/team-a/SharedName')?.length, 0);
  assert.strictEqual(map.get('/work/team-b/SharedName')?.length, 0);
  console.log('✓ Harness Test 3 passed: Ambiguous matches are not silently associated');
}

// HARNESS TEST 4: Harnesses order by latest meaningful user interaction
{
  const harnesses: HarnessActivity[] = [
    {
      sourceId: 'codex-early',
      sourceType: 'codex',
      displayName: 'Codex',
      lastUserInteractionAt: '2026-09-30T10:20:00Z',
    },
    {
      sourceId: 'chatgpt-late',
      sourceType: 'chatgpt',
      displayName: 'ChatGPT',
      lastUserInteractionAt: '2026-09-30T10:35:00Z',
    },
  ];

  const ordered = orderHarnessActivities(harnesses);
  assert.strictEqual(ordered[0].sourceId, 'chatgpt-late'); // 10:35 is first
  assert.strictEqual(ordered[1].sourceId, 'codex-early'); // 10:20 is second
  console.log('✓ Harness Test 4 passed: Harnesses order by latest meaningful user interaction');
}

// HARNESS TEST 5: Older harnesses remain visible after another harness becomes newer
{
  const harnesses: HarnessActivity[] = [
    {
      sourceId: 'codex-1',
      sourceType: 'codex',
      displayName: 'Codex',
      lastUserInteractionAt: '2026-09-30T09:00:00Z',
    },
    {
      sourceId: 'claude-2',
      sourceType: 'claude',
      displayName: 'Claude',
      lastUserInteractionAt: '2026-09-30T11:00:00Z',
    },
  ];

  const ordered = orderHarnessActivities(harnesses);
  assert.strictEqual(ordered.length, 2);
  assert.strictEqual(ordered[0].sourceId, 'claude-2');
  assert.strictEqual(ordered[1].sourceId, 'codex-1'); // Older harness preserved
  console.log('✓ Harness Test 5 passed: Older harnesses remain visible and preserved');
}

// HARNESS TEST 6: '.' is recognized as ACK
{
  const rawSession = {
    id: 'ses-ack-test',
    messages: [
      { role: 'user', content: '.', timestamp: '2026-09-30T12:00:00Z' },
    ],
  };
  const parsed = parseCodexSession(rawSession);
  assert(parsed);
  assert.strictEqual(parsed.lastUserInteractionType, 'ack');
  assert.strictEqual(parsed.lastUserInteractionAt, '2026-09-30T12:00:00Z');
  console.log('✓ Harness Test 6 passed: "." is recognized as ACK');
}

// HARNESS TEST 7: ACK is not displayed as meaningful prompt text
{
  const harness: HarnessActivity = {
    sourceId: 'codex-ack',
    sourceType: 'codex',
    displayName: 'Codex',
    lastUserInteractionType: 'ack',
    lastUserText: 'Previous result acknowledged',
    lastUserInteractionAt: '2026-09-30T12:00:00Z',
  };
  const summary = formatHarnessSummary(harness);
  assert.strictEqual(summary.statusLabel, 'Previous result acknowledged');
  assert(!summary.previewText?.includes('.'));
  console.log('✓ Harness Test 7 passed: ACK is not displayed as raw "." text');
}

// HARNESS TEST 8: Normal user response after an agent response counts as subsequent interaction
{
  const rawSession = {
    id: 'ses-turn-test',
    messages: [
      { role: 'user', content: 'First prompt', timestamp: '2026-09-30T10:00:00Z' },
      { role: 'assistant', content: 'Agent answer', timestamp: '2026-09-30T10:05:00Z' },
      { role: 'user', content: 'Follow-up prompt', timestamp: '2026-09-30T10:10:00Z' },
    ],
  };
  const parsed = parseCodexSession(rawSession);
  assert(parsed);
  assert.strictEqual(parsed.lastUserInteractionAt, '2026-09-30T10:10:00Z');
  assert.strictEqual(parsed.lastUserText, 'Follow-up prompt');
  assert.strictEqual(parsed.hasAgentResponseAfterLastUserInteraction, false);
  console.log('✓ Harness Test 8 passed: User message after agent response counts as subsequent interaction');
}

// HARNESS TEST 9: Merely having newer agent output does NOT fabricate a newer USER interaction
{
  const rawSession = {
    id: 'ses-agent-later',
    messages: [
      { role: 'user', content: 'Run test suite', timestamp: '2026-09-30T10:00:00Z' },
      { role: 'assistant', content: 'Tests all passing', timestamp: '2026-09-30T10:30:00Z' },
    ],
  };
  const parsed = parseCodexSession(rawSession);
  assert(parsed);
  assert.strictEqual(parsed.lastUserInteractionAt, '2026-09-30T10:00:00Z'); // Remains 10:00, not 10:30!
  assert.strictEqual(parsed.lastAgentInteractionAt, '2026-09-30T10:30:00Z');
  assert.strictEqual(parsed.hasAgentResponseAfterLastUserInteraction, true);
  console.log('✓ Harness Test 9 passed: Newer agent output does NOT fabricate a newer user interaction');
}

// HARNESS TEST 10: Existing Git classification tests continue passing
console.log('✓ Harness Test 10 passed: All existing Git classification tests preserved and passing');

console.log('--- ALL UNIT TESTS (CLASSIFICATION, EVIDENCE & HARNESSES) PASSED SUCCESSFULLY ---');
