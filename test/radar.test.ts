import assert from 'assert';
import {
  parsePorcelainV2,
  classifyAttention,
  computeSinceLastLooked,
} from '../src/lib/radar-core.js';

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
  assert(result.reasons.some((r) => r.includes('1 conflicted file')));
  console.log('✓ TEST 8 passed: Conflict => NEEDS_ME');
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

console.log('--- ALL UNIT TESTS (INCLUDING TESTS 1 TO 8) PASSED SUCCESSFULLY ---');
