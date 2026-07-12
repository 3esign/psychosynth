import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { toResponse } from '@/modules/core/errors';

// Without this, Next statically optimizes the parameterless GET at build time
// and /api/health would serve a stale, build-time snapshot forever.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Run a quick query to verify database connection health
    const { error } = await dbAdmin.from('biases').select('id').limit(1);
    if (error) throw error;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return toResponse(e);
  }
}
