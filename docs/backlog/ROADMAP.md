# Riqor Development Roadmap

The roadmap orders outcomes by dependency and release target

## 0.2.0 Foundation

- `RIQ-101` merge and release the Assured Trace Foundation
- land the governed backlog foundation
- validate generated portfolio and current-focus views

Exit condition: trace state and backlog governance are merged with current-head evidence

## 0.3.0 Assured Execution

- `RIQ-102` Assured Ledger and execution cards
- `RIQ-103` state-adaptive context injection
- `RIQ-104` failure attribution and run budgets
- `RIQ-105` phase boundary completion guards

Exit condition: an assured run cannot finish with open cards, stale evidence, or exhausted retry policy

## 0.4.0 Ecosystem Integration

- `RIQ-201` ecosystem capability registry
- `RIQ-202` Agent Kernel read-only adapter
- `RIQ-203` Delegate Team read-only adapter
- `RIQ-204` Dokion read-only adapter

Exit condition: Riqor can inspect bounded capability and evidence summaries without owning memory, routing, or Playbook execution

## 0.5.0 Recovery and Evaluation

- `RIQ-301` checkpoint creation
- `RIQ-302` repository-bound resume
- `RIQ-303` approval digest binding
- `RIQ-401` assured execution evaluation scenarios
- `RIQ-402` privacy and leakage regression pack

Exit condition: interrupted runs resume safely and critical execution and privacy guarantees are deterministic regressions

## 0.6.0 GitHub Plan Bridge

- `RIQ-501` explicit GitHub plan bridge
- `RIQ-502` backlog drift report

Exit condition: GitHub mirrors can be created and audited explicitly while repository records remain authoritative

## Sequencing Rule

Do not start a dependent release slice until every prerequisite item is `done`
