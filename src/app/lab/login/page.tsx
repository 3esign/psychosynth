'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/modules/core/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authErr } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr) {
        throw authErr;
      }

      // Success! Refresh router and redirect to /lab Cockpit
      router.refresh();
      router.push('/lab');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-purple-900/30">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20">
            <span className="text-white font-bold tracking-widest text-lg">P</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
            Psychosynth Lab Access
          </h2>
          <p className="text-sm text-neutral-400 font-mono">
            Provide admin credentials to enter the cockpit
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs font-semibold text-red-400">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={loading}
                className="mt-2 block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="mt-2 block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/15 outline-none transition-all hover:brightness-110 focus:ring-2 focus:ring-purple-600 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                <span>Authenticating...</span>
              </span>
            ) : (
              <span>Enter Lab Cockpit</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
