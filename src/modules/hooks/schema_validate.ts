import Ajv from 'ajv';
import { Hook } from './types';

const ajv = new Ajv({ allErrors: true });

export const schemaValidate: Hook = async (ctx) => {
  const itemSchema = (ctx.generator.output_schema as any).properties.items.items;
  const ok = ajv.compile(itemSchema)(ctx.item);
  return {
    hook: 'schema_validate',
    passed: !!ok,
    verdict: ok ? undefined : 'reject',
    data: ok ? {} : { errors: ajv.errorsText() }
  };
};
