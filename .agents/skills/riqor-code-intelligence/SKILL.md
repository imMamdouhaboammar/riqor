---
name: riqor-code-intelligence
description: Use when indexing a codebase, searching AST chunks, retrieving hybrid symbol relevance, or performing code-path tracing using Riqor engines.
---

# Riqor Code Intelligence

## Core Rule
Perform exact code search and AST symbol retrieval using Riqor's incremental index and hybrid retriever instead of guessing schema definitions or file paths.

## Key Capabilities

1. **AST Chunking & Symbol Indexing**:
   Index code symbols incrementally with fast caching:
   ```bash
   riqor harness index --root ./src
   ```

2. **Hybrid Retrieval**:
   Search symbols with token budget constraints and relevance scoring:
   ```bash
   riqor harness search "GoalLoopOrchestrator"
   ```

3. **Symbol Traversal**:
   Trace definitions, exported interfaces, and dependencies before modifying complex functions.
