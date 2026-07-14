-- Fix recipe_id for cognitive-bias-simulator to point to the recipe with entity: bias.
-- (The previous migration ordered by id DESC on UUID v4, which was non-deterministic).
UPDATE products
SET recipe_id = (SELECT id FROM recipes WHERE query_rules->>'entity' = 'bias' LIMIT 1)
WHERE slug = 'cognitive-bias-simulator';
