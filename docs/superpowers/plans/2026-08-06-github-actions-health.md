# GitHub Actions Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reliable repository checks while keeping the public README focused on Riqor itself.

**Architecture:** Fix the Bun-specific documentation assertion without weakening file validation. Keep GitHub Actions details in the automation guide, remove them from the public README, and use hosted workflow runs as the final verification source.

**Tech Stack:** Bun 1.3.14, TypeScript tests, GitHub Actions

## Global Constraints

- Preserve exact action SHA pins
- Do not weaken CI, security scanning, or artifact checks
- Keep workflow and credential setup in `docs/AUTOMATION.md`, not `README.md`
- Verify the final commit on `main`

---

### Task 1: Keep README focused on Riqor core

**Files:**
- Modify: `README.md`
- Modify: `test/public-repository.test.ts`

- [x] Remove CI, SecureAI-Scan, and AutoDemo badges from the README
- [x] Remove the Automation navigation item and Repository Automation section
- [x] Remove the automation guide from the README documentation list
- [x] Add regression assertions preventing these items from returning

### Task 2: Repair documentation file checks

**Files:**
- Modify: `test/documentation.test.ts`

- [x] Replace matcher-wrapped `access()` calls with direct awaited calls
- [ ] Verify focused documentation tests
- [ ] Verify the complete repository test and package gate

### Task 3: Verify hosted workflows

**Files:**
- Review: `.github/workflows/ci.yml`
- Review: `.github/workflows/secureai.yml`
- Review: `.github/workflows/autodemo.yml`
- Review: `.github/workflows/dynamic-badges.yml`

- [ ] Confirm CI passes on the pull request
- [ ] Confirm SecureAI-Scan completes and review any findings
- [ ] Confirm AutoDemo completes and produces its artifact
- [ ] Merge after verification
- [ ] Confirm CI and Dynamic Badges complete on `main`
