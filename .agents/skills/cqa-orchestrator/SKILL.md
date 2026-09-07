# CQA Orchestrator Skill

## Purpose
Coordinate the multi-agent Codex system for repository audit, implementation, testing, and release.

## Responsibilities

### Workflow Coordination
- Sequence agents: Builder → Tester → Optimiser → Release Auditor
- Manage dependencies and blocking issues
- Aggregate results and produce final release report
- Track completion status of each phase

### Communication
- Clarify requirements with the user
- Summarise findings from each agent
- Identify gaps or conflicts
- Report blockers or external dependencies

### Quality Gates
- Ensure tester validates before optimiser works
- Prevent release without auditor sign-off
- Escalate code-fixable issues back to Builder
- Document all environment/infrastructure constraints

### Documentation
- Update AGENTS.md with completed status
- Record environment variables discovered
- Log deployment constraints
- Produce final CQA PRODUCTION RELEASE REPORT

## When to Act
- User requests repository audit
- New phase begins
- Agent findings require coordination
- External dependencies block progress
- Final handoff to production

## Integration Points
- Reads AGENTS.md for mission and quality bar
- Consults existing codebase architecture
- Receives audit data from Builder
- Receives test results from Tester
- Receives UX improvements from Optimiser
- Receives ship-readiness verdict from Release Auditor
