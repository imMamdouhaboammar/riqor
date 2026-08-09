/**
 * Decoupled Event-Driven Agent Lifecycle State Machine (inspired by lsdefine/GenericAgent)
 * Manages explicit agent states and activator checkpoint transitions safely.
 */

export type AgentState = "IDLE" | "TURNING" | "MUTATING" | "CHECKPOINT_DUE" | "VERIFYING" | "STOPPED";
export type AgentEvent = "START" | "MUTATE" | "TICK_INTERVAL" | "VERIFY" | "COMPLETE_VERIFICATION" | "STOP" | "RESET";

export type StateChangeListener = (newState: AgentState, oldState: AgentState, event: AgentEvent) => void;

const TRANSITION_MAP: Record<AgentState, Partial<Record<AgentEvent, AgentState>>> = {
  IDLE: {
    START: "TURNING",
    STOP: "STOPPED",
  },
  TURNING: {
    MUTATE: "MUTATING",
    TICK_INTERVAL: "CHECKPOINT_DUE",
    VERIFY: "VERIFYING",
    STOP: "STOPPED",
  },
  MUTATING: {
    VERIFY: "VERIFYING",
    TICK_INTERVAL: "CHECKPOINT_DUE",
    STOP: "STOPPED",
  },
  CHECKPOINT_DUE: {
    VERIFY: "VERIFYING",
    STOP: "STOPPED",
  },
  VERIFYING: {
    COMPLETE_VERIFICATION: "TURNING",
    STOP: "STOPPED",
  },
  STOPPED: {
    RESET: "IDLE",
    STOP: "STOPPED",
  },
};

export class AgentLifecycleStateMachine {
  private currentState: AgentState = "IDLE";
  private listeners: Set<StateChangeListener> = new Set();

  public getState(): AgentState {
    return this.currentState;
  }

  public canTransition(event: AgentEvent): boolean {
    const allowed = TRANSITION_MAP[this.currentState];
    return allowed !== undefined && allowed[event] !== undefined;
  }

  public transition(event: AgentEvent): AgentState {
    const allowedMap = TRANSITION_MAP[this.currentState];
    const nextState = allowedMap ? allowedMap[event] : undefined;

    if (!nextState) {
      throw new Error(`Invalid lifecycle transition: cannot trigger event '${event}' from state '${this.currentState}'`);
    }

    const oldState = this.currentState;
    this.currentState = nextState;

    for (const listener of this.listeners) {
      try {
        listener(nextState, oldState, event);
      } catch (err) {
        console.error("StateChangeListener error:", err);
      }
    }

    return this.currentState;
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
