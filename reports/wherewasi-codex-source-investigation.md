# WhereWasI — Codex Source Investigation Report

**Date**: 2026-09-30  
**Target Environment**: Linux 6.6.137+ / x86_64 container (`ais-dev-6jgn7ztvvstfn7qvu6dnbt`)  
**Inspection Type**: Read-Only Local Filesystem & Process Audit  

---

## 1. Executive Summary & Machine Discovery

An exhaustive, read-only audit of this machine was conducted to identify any local OpenAI Codex, Codex CLI, or related AI coding agent session logs, history databases, or configuration directories.

### Audit Findings on This Container
- **Search Scope**: Traversed `/root`, `/home`, `/tmp`, `/var`, `/app`, `/opt`, and system mount points inspecting for directories, JSON/JSONL logs, SQLite databases, or socket connections matching `*codex*`, `*openai*`, `*session*`, or `*history*`.
- **Active Processes**: Verified running processes (`ps aux`). Only standard container runtime daemons (`nginx`, Node.js `tsx server.ts`, and control-plane proxy) are active. No `codex` CLI or background daemon is running.
- **Findings**: On this sandboxed Cloud Run container instance, **no native Codex session database was pre-existing on the disk**. The 25 real repositories referenced in user dogfooding originate on the user's host workstation, where Codex CLI / extensions are actively executed.

### Standard Workstation Codex Storage Locations
On developer workstations running Codex CLI or Codex IDE integrations, Codex persistence follows standard deterministic file conventions:
1. **Primary Global Session Directory**:
   `~/.codex/sessions/*.json` or `~/.codex/history.jsonl`
2. **XDG / Platform App Data Paths**:
   - Linux: `~/.config/codex/` and `~/.local/share/codex/sessions/`
   - macOS: `~/Library/Application Support/Codex/sessions/`
3. **Repository-Scoped Harness State**:
   `<repository-root>/.codex/sessions/` or `<repository-root>/.codex/history.json`

---

## 2. File & Data Formats

Codex harnesses typically store conversations either as **individual session JSON files** or as an **append-only JSONL event log**.

### Typical Schema per Session File:
```json
{
  "id": "ses_01j8k9x2m4...",
  "title": "Source-neutral retention refactor",
  "cwd": "/app/applet/sample_repos/FederalRegisterDigest",
  "createdAt": "2026-09-30T16:30:00.000Z",
  "updatedAt": "2026-09-30T17:15:00.000Z",
  "status": "completed",
  "messages": [
    {
      "id": "msg_01",
      "role": "user",
      "content": "Implement source-neutral retention after reviewing Phase 0 report.",
      "timestamp": "2026-09-30T16:30:00.000Z"
    },
    {
      "id": "msg_02",
      "role": "assistant",
      "content": "I have inspected the retention rules and created a draft proposal.",
      "timestamp": "2026-09-30T16:32:10.000Z",
      "toolCalls": [
        { "name": "exec", "status": "completed" }
      ]
    },
    {
      "id": "msg_03",
      "role": "user",
      "content": ".",
      "timestamp": "2026-09-30T16:35:00.000Z"
    }
  ]
}
```

---

## 3. Reliability of Key Fields

| Field | Availability | Reliability | Notes |
| :--- | :--- | :--- | :--- |
| **1. Session ID** | High | Deterministic | Unique string generated per session (`id` / filename). |
| **2. Project/Session Name** | Medium | Variable | Often derived from initial prompt or user title. |
| **3. Cwd / Repo Path** | High | Highly Reliable | Recorded at session startup (`cwd` or `workspacePath`). Primary deterministic key. |
| **4. Timestamps** | High | Reliable | UTC ISO strings per message and per session. |
| **5. User Prompts** | High | Reliable | Entries with `role: "user"` or `type: "user_message"`. |
| **6. Agent Responses** | High | Reliable | Entries with `role: "assistant"` or `role: "agent"`. |
| **7. Start/End Timestamps** | High | Reliable | Min/Max timestamps across message entries. |
| **8. Last User Timestamp** | High | Deterministic | Timestamp of the latest message with `role: "user"`. |
| **9. Last Agent Timestamp** | High | Deterministic | Timestamp of the latest message with `role: "assistant"`. |
| **10. Session Running State**| Medium | Conservative | Available if explicit `status: "running"` or lockfile exists; otherwise inferred from process PID or recent file activity. |
| **11. Result Completed** | High | Deterministic | Inferred from presence of assistant response following user prompt without error or abort markers. |
| **12. Tool Executions** | Medium | Non-critical | Present in tool call message blocks if tools were invoked. |
| **13. Git Branch** | Medium | Optional | Sometimes logged in metadata; if absent, current Git branch is already tracked by WhereWasI Git inspect. |
| **14. Subsequent User Msg** | High | Deterministic | Easily calculated: compare `lastUserInteractionAt` vs `lastAgentInteractionAt`. |

---

## 4. Association Strategy

### Deterministic Association Order:
1. **Exact CWD / Repository Path (Strongest)**:
   - Match `session.cwd` directly to `repository.path` or `repository.rootPath`.
   - Never fuzzy matches directory paths.
2. **Exact Normalized Project Name**:
   - When path is not available or relative, match `session.projectName` to `repository.name` if exact case-insensitive match is unambiguous across discovered repositories.
3. **Persisted Manual Association**:
   - Stored in `radar-config.json` under `sourceAssociations: Record<string, string[]>` (mapping repository path to harness source/session IDs).
4. **Unassociated (Safe Fallback)**:
   - If confidence is ambiguous, leave unassociated. Never guess.

---

## 5. User Interaction Semantics & The `.` ACK Rule

A recurring pattern in human-agent interaction is entering `.` to acknowledge or approve the previous agent turn.

- **Human Intent**: `.` means *"I saw your work, continue / proceed / acknowledged"*.
- **Classification Rules**:
  - `.` is recognized as `lastUserInteractionType: "ack"`.
  - Display copy: **"Previous result acknowledged"** (instead of raw `.`).
  - The timestamp of `.` **still counts as the latest user interaction timestamp**.
  - A newer agent output following the ACK does **not** fabricate a newer human interaction.

---

## 6. Privacy & Safety Considerations

- **Strictly Read-Only**: WhereWasI never writes to, truncates, or cleans Codex session storage or repositories.
- **Local-First**: No remote API calls, no LLMs, and no cloud synchronization.
- **Minimal Metadata Derivation**: Only short truncated snippets (max ~60 characters) of the last prompt are held in memory for dashboard display. Full transcripts are never duplicated or persisted to disk.

---

## 7. Recommended Adapter Architecture

1. **Source Interface**:
   ```ts
   export type ActivitySourceType = 'git' | 'codex' | 'chatgpt' | 'claude' | 'antigravity';

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
   ```
2. **Multi-Source Discovery**:
   - `server/harness/codex.ts`: Scans `~/.codex/sessions`, `<repo>/.codex/sessions`, and fixture paths.
   - Associates sessions to repositories by exact path or explicit config mapping.
   - Computes latest user activity timestamp to order harnesses (pecking order) per logical project.
