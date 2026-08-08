export type RiqorLifecycleEvent = "SessionStart" | "PreToolUse" | "PostToolUse" | "Stop" | "SessionEnd";

export interface LifecycleHookContext {
  sessionId: string;
  repoRoot: string;
  event: RiqorLifecycleEvent;
  payload?: Record<string, unknown>;
}

export interface LifecycleHookDecision {
  allow: boolean;
  reason?: string;
  modifiedPayload?: Record<string, unknown>;
}

export type LifecycleHookHandler = (
  context: LifecycleHookContext,
) => LifecycleHookDecision | Promise<LifecycleHookDecision>;

const registeredHooks: Map<RiqorLifecycleEvent, LifecycleHookHandler[]> = new Map();

export function registerLifecycleHook(event: RiqorLifecycleEvent, handler: LifecycleHookHandler): void {
  const existing = registeredHooks.get(event) || [];
  existing.push(handler);
  registeredHooks.set(event, existing);
}

export async function executeLifecycleHooks(context: LifecycleHookContext): Promise<LifecycleHookDecision> {
  const handlers = registeredHooks.get(context.event) || [];
  for (const handler of handlers) {
    const decision = await handler(context);
    if (!decision.allow) {
      return decision;
    }
  }
  return { allow: true };
}
