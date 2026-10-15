import { useEffect, useRef, useState } from "react";
import { supabase } from "../integrations/client";
import { ProgressError } from "../integrations/progress";
import { saveSchedule, type ScheduleOperation } from "../integrations/schedule";

type State = { scope: string; busy?: boolean; error?: ProgressError["kind"]; saved?: boolean };
export function useScheduleMutation(scope: string, reload: () => void) {
  const [state, setState] = useState<State>({ scope });
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<{ scope: string; operation: ScheduleOperation } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    pending.current = null;
  }, [scope]);
  async function execute(operation: ScheduleOperation, retry = false) {
    if (!supabase || controller.current || (!retry && pending.current?.scope === scope)) return;
    const epoch = generation.current;
    const request = new AbortController();
    controller.current = request;
    pending.current = { scope, operation };
    setState({ scope, busy: true });
    let timer: number | undefined;
    try {
      await Promise.race([
        saveSchedule(supabase, operation, request.signal),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => { request.abort(); reject(new ProgressError("unknown")); }, 15000);
        }),
      ]);
      if (generation.current !== epoch || currentScope.current !== scope) return;
      pending.current = null;
      setState({ scope, saved: true });
      reload(); // Receipts can describe an older successful retry: always read current DB values.
    } catch (error) {
      if (generation.current !== epoch || currentScope.current !== scope) return;
      setState({ scope, error: error instanceof ProgressError ? error.kind : "unknown" });
    } finally {
      window.clearTimeout(timer);
      if (generation.current === epoch) controller.current = null;
    }
  }
  const visible = state.scope === scope ? state : { scope };
  return {
    ...visible,
    blocked: Boolean(visible.busy || visible.error),
    begin: (operation: Omit<ScheduleOperation, "requestId">) => void execute({ ...operation, requestId: crypto.randomUUID() }),
    retry: () => { if (pending.current?.scope === scope) void execute(pending.current.operation, true); },
    refresh: () => { if (controller.current) return; pending.current = null; setState({ scope }); reload(); },
  };
}
