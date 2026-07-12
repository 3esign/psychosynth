import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { err } from './errors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env variables.');
}

export async function requireAdmin(_req: Request) {
  const store = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.email) {
    throw err('unauthorized', 401, 'login required');
  }
  
  const allow = (process.env.ADMIN_EMAILS ?? 'owner@example.com').split(',').map(s => s.trim());
  if (!allow.includes(user.email)) throw err('forbidden', 403, 'not an admin');
  
  return { email: user.email };
}
