import React, { useState } from 'react';
import { FolderPlus, Sparkles, Folder, Terminal } from 'lucide-react';

interface EmptyStateProps {
  onAddFolder: (path: string) => Promise<void>;
  onSeedDogfood: () => Promise<void>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onAddFolder,
  onSeedDogfood,
}) => {
  const [folderPath, setFolderPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;

    setErrorMsg(null);
    try {
      setIsSubmitting(true);
      await onAddFolder(folderPath.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDogfood = async () => {
    setErrorMsg(null);
    try {
      setIsSeeding(true);
      await onSeedDogfood();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-16 px-6 py-10 rounded-2xl bg-[#0c1017] border border-[#1d2535] text-center shadow-xl">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
        <Folder className="w-6 h-6" />
      </div>

      <h2 className="text-xl font-bold text-zinc-100 tracking-tight mb-2">
        Agent Project Radar
      </h2>

      <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto mb-6">
        Add a folder containing your Git repositories and Radar will reconstruct their current state locally.
      </p>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md mx-auto mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/repositories or ~/code"
            className="flex-1 bg-[#121824] text-xs font-mono text-zinc-100 placeholder:text-zinc-500 px-3.5 py-2.5 rounded-lg border border-[#263347] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={isSubmitting || !folderPath.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors disabled:opacity-50"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Folder</span>
          </button>
        </div>

        {errorMsg && (
          <div className="text-rose-400 text-xs font-mono text-left">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Divider */}
      <div className="relative my-6 max-w-md mx-auto">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0c1017] px-2 text-zinc-500 font-mono">or test instantly</span>
        </div>
      </div>

      {/* Dogfood Button */}
      <div className="max-w-md mx-auto">
        <button
          onClick={handleDogfood}
          disabled={isSeeding}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#141d2a] hover:bg-[#1a2536] text-amber-300 border border-amber-900/40 text-xs font-mono transition-colors"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            {isSeeding ? 'Initializing sample Git repositories...' : 'Load Dogfood Repositories (FederalRegisterDigest, etc.)'}
          </span>
        </button>
        <p className="text-[11px] text-zinc-500 mt-2 font-mono">
          Creates 4 local Git repositories demonstrating dirty trees, branches, stashes, and NEXT notes.
        </p>
      </div>
    </div>
  );
};
