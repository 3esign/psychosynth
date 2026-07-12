export interface HookResult {
  hook: string;
  passed: boolean;
  score?: number;
  data?: Record<string, unknown>;
  verdict?: 'reject' | 'pending' | 'approve';
}

export interface HookContext {
  item: any;
  generator: any;
  run: any;
  prior: HookResult[];
}

export type Hook = (ctx: HookContext, config: Record<string, unknown>) => Promise<HookResult>;
