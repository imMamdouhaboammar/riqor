---
name: agent-kernel-evolve
description: Proposal-only workflow learning guide for AI agents. Use repeated failures or corrections to draft reviewed, non-persistent learning proposals before any durable write.
---

# Agent Kernel Self-Evolve Operations Guide

This skill evaluates repeated evidence and drafts a non-persistent proposal by default. It does not authorize automatic learning capture, Playbook creation, Rule creation, hook installation, or durable storage.

## Triggers & Trigger Phrases
Activate this skill when:
- The user mentions `self-evolve`, `/learn`, `playbook`, `workflow synthesis`, or `agent learning`.
- You resolve a complex multi-step feature or receive a user correction that may justify a future Playbook or Rule. A single event starts proposal evaluation only. Require repeated failures or corrections showing the same pattern before drafting a non-persistent proposal.

## 1. Playbook Operations (`agent-kernel evolve`)

Require explicit user approval before any command writes a Playbook, Rule, hook configuration, or durable learning record. Present the repeated evidence, proposed scope, retention, validation cases, rollback, and exact write command before requesting approval. Read-only list and inspect operations may run when already authorized by the task.

- **Generate an approved Playbook from a reviewed proposal:**
  `agent-kernel evolve generate --title "Full Next.js Auth Setup" --topic "auth"`
- **List All Generated Playbooks:**
  `agent-kernel evolve list`
- **Inspect a Playbook & Evolution History:**
  `agent-kernel evolve inspect <playbookId>`
- **Evolve/Repair a Playbook after explicit user approval:**
  `agent-kernel evolve repair <playbookId> --reason "Fixed Supabase redirect URL"`

## 2. Universal Self-Evolve Hooks (`agent-kernel evolve hooks`)

Before either command in this section, obtain explicit opt-in approval for the named agent environments and reviewed paths. Use workflow metadata and synthetic examples only. Reject or redact credentials, personal data, source payloads, command output, and sensitive paths. Define retention, access, and removal controls before enabling durable capture.

- **Install Hooks for Antigravity, Claude, Cursor, Codex, Gemini, OpenCode:**
  `agent-kernel evolve hooks`
- **Execute Hook Background Processing after explicit opt-in approval:**
  `agent-kernel hook self-evolve`
