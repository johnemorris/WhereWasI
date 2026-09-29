import React, { useState } from 'react';
import {
  X,
  Download,
  Github,
  Check,
  AlertCircle,
  ExternalLink,
  Shield,
  Smartphone,
} from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState('where-was-i');
  const [isPrivate, setIsPrivate] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    url?: string;
    error?: string;
  } | null>(null);

  const handlePushToGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsPushing(true);
    setPushResult(null);

    try {
      const res = await fetch('/api/export/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          repoName: repoName.trim(),
          isPrivate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPushResult({ success: false, error: data.error || 'Failed to export' });
      } else {
        setPushResult({ success: true, url: data.repoUrl });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPushResult({ success: false, error: msg });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#0b0f16] border border-[#232b3b] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1b2332] bg-[#0e141e]/80">
          <div className="flex items-center gap-2.5">
            <Github className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Export Project: <span className="font-mono text-amber-300">where-was-i</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-300">
          {/* Method 1: Push directly to Private GitHub */}
          <div className="bg-[#101724] border border-[#202c3e] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs">
              <Github className="w-4 h-4 text-zinc-200" />
              <span>Push directly to your GitHub (Private Repo)</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Enter a GitHub Personal Access Token (classic with <code className="text-amber-300">repo</code> scope or fine-grained with Repository creation &amp; contents permission). Radar will create the private repo and push <code className="text-zinc-200">main</code>.
            </p>

            <form onSubmit={handlePushToGithub} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-[#0a0e15] border border-[#232f42] text-xs font-mono text-zinc-200 px-3 py-1.5 rounded focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1 flex items-center justify-between">
                  <span>GitHub Personal Access Token</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=AgentProjectRadarExport"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-1 text-[10px]"
                  >
                    <span>Generate token on GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  className="w-full bg-[#0a0e15] border border-[#232f42] text-xs font-mono text-zinc-200 px-3 py-1.5 rounded focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-repo"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded bg-[#0a0e15] border-zinc-700 text-amber-500 focus:ring-0"
                />
                <label htmlFor="private-repo" className="text-[11px] text-zinc-300 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>Make repository <strong>Private</strong></span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isPushing || !token.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {isPushing ? (
                  <span>Pushing to GitHub...</span>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5" />
                    <span>Create &amp; Push to GitHub</span>
                  </>
                )}
              </button>
            </form>

            {pushResult && (
              <div
                className={`p-3 rounded border text-xs font-mono ${
                  pushResult.success
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                {pushResult.success ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Repository successfully created and pushed!</span>
                    </div>
                    <a
                      href={pushResult.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-amber-300 flex items-center gap-1 pt-1 break-all"
                    >
                      <span>{pushResult.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="break-all">{pushResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Method 2: Direct ZIP Download */}
          <div className="bg-[#101724] border border-[#202c3e] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-100 text-xs">
                Download Code Archive (.zip)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Fast &amp; Offline</span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              Download the entire repository codebase as a single clean ZIP file directly onto your phone or computer.
            </p>
            <a
              href="/api/export/zip"
              download="where-was-i.zip"
              className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded bg-[#192435] hover:bg-[#223147] text-zinc-200 border border-[#2b3c55] font-mono text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download where-was-i.zip</span>
            </a>
          </div>

          {/* Method 3: Mobile AI Studio Tip */}
          <div className="bg-[#0e131d] border border-[#1b2332] rounded-lg p-3 text-[11px] text-zinc-400 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-zinc-300">Viewing AI Studio from Mobile?</strong>
              <p>
                In mobile Safari or Chrome, tap the <strong>&quot;aA&quot;</strong> or <strong>three-dots (⋮)</strong> menu in your browser bar and select <strong>&quot;Request Desktop Website&quot;</strong>. This reveals AI Studio&apos;s full desktop navigation bar with the native GitHub Export button.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1b2332] bg-[#0e141e]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#16202e] hover:bg-[#1f2b3e] text-zinc-200 font-medium text-xs border border-[#2b374a] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
