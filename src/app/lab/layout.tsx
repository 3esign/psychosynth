import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const heads = await headers();
  const pathname = heads.get('x-next-pathname') || '';

  const isLoginPage = pathname === '/lab/login';

  let user: any = null;
  let isAllowed = false;

  // Initialize Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored from Server Components
          }
        },
      },
    }
  );

  if (!isLoginPage) {
    const { data } = await supabase.auth.getUser();
    user = data?.user;

    if (!user) {
      redirect('/lab/login');
    }

    const allow = (process.env.ADMIN_EMAILS ?? 'owner@example.com').split(',').map(s => s.trim());
    isAllowed = allow.includes(user.email || '');

    if (!isAllowed) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-300 font-mono text-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <span className="text-xl font-bold">403</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
              Access Denied
            </h2>
            <p className="text-neutral-400">
              Your account <span className="text-red-400 font-mono">{user.email}</span> is not on the admin allowlist.
            </p>
            <form action={async () => {
              'use server';
              const cookieStore = await cookies();
              const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                  cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                      cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                      );
                    }
                  }
                }
              );
              await supabase.auth.signOut();
              redirect('/lab/login');
            }} className="pt-4">
              <button type="submit" className="w-full py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-950 text-neutral-300 hover:text-white font-bold transition-all">
                Sign Out / Switch Account
              </button>
            </form>
          </div>
        </div>
      );
    }
  }

  // If it is the login page, render children directly without navbar
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 font-mono text-sm selection:bg-purple-900/50">
        <main className="max-w-7xl mx-auto p-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 font-mono text-sm selection:bg-purple-900/50">
      <nav className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="font-bold text-white tracking-widest uppercase flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              Psychosynth Lab
            </div>
            <div className="flex gap-6">
              <Link href="/lab/review" className={`transition-colors ${pathname === '/lab/review' ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>Curation Queue</Link>
              <Link href="/lab/run" className={`transition-colors ${pathname === '/lab/run' ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>Run Generator</Link>
              <Link href="/lab/browse" className={`transition-colors ${pathname === '/lab/browse' ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>Browse Data</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-500 max-w-[150px] truncate">{user?.email}</span>
            <form action={async () => {
              'use server';
              const cookieStore = await cookies();
              const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                  cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                      cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                      );
                    }
                  }
                }
              );
              await supabase.auth.signOut();
              redirect('/lab/login');
            }}>
              <button type="submit" className="px-3 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all text-xs border border-neutral-800">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
