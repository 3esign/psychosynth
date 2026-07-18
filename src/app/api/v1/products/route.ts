import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { toResponse, err } from '@/modules/core/errors';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';

export async function GET(req: Request) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }

    const { data, error } = await dbAdmin
      .from('products')
      .select('slug, name, description, price_model')
      .eq('status', 'live');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    return toResponse(e);
  }
}
