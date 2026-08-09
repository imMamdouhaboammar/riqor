import { describe, expect, test } from "bun:test";
import { AgentLifecycleStateMachine, type AgentState } from "../src/agent-lifecycle-state-machine.js";

describe("AgentLifecycleStateMachine (inspired by lsdefine/GenericAgent)", () => {
  test("initializes in IDLE state", () => {
    const fsm = new AgentLifecycleStateMachine();
    expect(fsm.getState()).toBe("IDLE");
  });

  test("transitions through normal lifecycle: IDLE -> TURNING -> MUTATING -> VERIFYING -> IDLE", () => {
    const fsm = new AgentLifecycleStateMachine();

    fsm.transition("START");
    expect(fsm.getState()).toBe("TURNING");

    fsm.transition("MUTATE");
    expect(fsm.getState()).toBe("MUTATING");

    fsm.transition("VERIFY");
    expect(fsm.getState()).toBe("VERIFYING");

    fsm.transition("COMPLETE_VERIFICATION");
    expect(fsm.getState()).toBe("TURNING");
  });

  test("handles activator checkpoint due trigger", () => {
    const fsm = new AgentLifecycleStateMachine();
    fsm.transition("START");

    fsm.transition("TICK_INTERVAL");
    expect(fsm.getState()).toBe("CHECKPOINT_DUE");

    fsm.transition("VERIFY");
    expect(fsm.getState()).toBe("VERIFYING");
  });

  test("prevents invalid state transitions and throws explicit error", () => {
    const fsm = new AgentLifecycleStateMachine();
    fsm.transition("STOP");

    expect(fsm.getState()).toBe("STOPPED");
    expect(() => fsm.transition("MUTATE")).toThrow("Invalid lifecycle transition");
  });

  test("notifies state change listeners on transition", () => {
    const fsm = new AgentLifecycleStateMachine();
    const transitions: AgentState[] = [];

    fsm.onStateChange((newState) => {
      transitions.push(newState);
    });

    fsm.transition("START");
    fsm.transition("MUTATE");

    expect(transitions).toEqual(["TURNING", "MUTATING"]);
  });
});
