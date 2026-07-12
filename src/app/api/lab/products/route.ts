import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { data, error } = await dbAdmin
      .from('products')
      .select('*, recipes (*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();

    // Find if product already exists by slug
    const { data: existingProduct, error: fetchErr } = await dbAdmin
      .from('products')
      .select('id, recipe_id, status')
      .eq('slug', body.slug)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    let recipeId;
    if (existingProduct) {
      recipeId = existingProduct.recipe_id;
      // Update recipe
      const { error: recipeErr } = await dbAdmin
        .from('recipes')
        .update({
          query_rules: body.recipe.query_rules,
          composition_rules: body.recipe.composition_rules,
        })
        .eq('id', recipeId);
      if (recipeErr) throw recipeErr;
    } else {
      // Create new recipe
      const { data: recipe, error: recipeErr } = await dbAdmin
        .from('recipes')
        .insert({
          query_rules: body.recipe.query_rules,
          composition_rules: body.recipe.composition_rules,
        })
        .select()
        .single();
      if (recipeErr) throw recipeErr;
      recipeId = recipe.id;
    }

    // Insert or update product
    const { data: product, error: prodErr } = await dbAdmin
      .from('products')
      .upsert({
        id: existingProduct?.id || undefined,
        slug: body.slug,
        name: body.name,
        description: body.description,
        recipe_id: recipeId,
        price_model: body.price_model,
        status: body.status || 'draft',
      })
      .select()
      .single();

    if (prodErr) throw prodErr;

    const wasLive = existingProduct && existingProduct.status === 'live';
    const isLive = product.status === 'live';

    if (isLive && !wasLive) {
      emit({
        event_type: 'product.published',
        actor_type: 'human',
        actor_id: admin.email,
        payload: { slug: product.slug, price_model: product.price_model },
      });
    }

    return NextResponse.json(product);
  } catch (e) {
    return toResponse(e);
  }
}
