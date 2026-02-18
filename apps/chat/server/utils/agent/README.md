# Agent Utilities Structure

This directory groups the server-side agent orchestration logic by responsibility:

- `create-agent.ts` - `ToolLoopAgent` assembly and lifecycle hooks (`prepareCall`, `prepareStep`)
- `context-management.ts` - context compaction logic (`compactContext`)
- `step-policy.ts` - step budgeting and tool-loop guardrails (`shouldForceTextOnlyStep`)
- `sanitize.ts` - message sanitation before model calls (`sanitizeToolCallInputs`)
- `schemas.ts` - Zod schemas for call options
- `types.ts` - shared types for routing and agent execution context

This is the canonical server agent module layout (no legacy compatibility layer).
