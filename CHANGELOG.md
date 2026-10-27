# Changelog

## 3.1.0 — 27 October 2026

### Fixed readiness gaps (each reproduced by a failing test first)
1. An approved rule could change without a rev change and still be
   Development-Ready. Approvals are now bound to content fingerprints.
2. A final document with only a Status line and IDs could pass. The document must
   now contain each rule and criterion text from the state.
3. A target path such as DAB could be omitted. The PBI now records its path scope
   (cdms and dab required), and every rule must assess every path that applies.
4. A rule could cite an evidence ID with no record. Evidence IDs must now resolve
   to evidence records.
3.0.0 accepted all four as Development-Ready; 3.1.0 rejects all four (MEASUREMENTS.md).

### Approvals
- `pbi-state.json` schemaVersion 2. The check computes a 16-hex fingerprint per
  record in each approval scope (PO/BA, technical, final user), including the
  content of local evidence files. An approval records that `basis` as printed by
  the check. Any change, addition or removal makes the affected approvals stale
  and the report names the IDs. Whitespace-only reformatting does not.
- The approver is recorded (by, at, evidence), not authenticated. Old approvals
  move to `approvalHistory` as stale; history and decisions are never deleted.
- 3.0.0 approvals (rev-number basis) are reported as unbound and never count.

### Document, state and evidence consistency
- Rule and criterion text must be present, not a placeholder (TBD/TODO/TBC) and
  at least 12 characters, and must appear in the PBI document. Dependency IDs
  must be in the document; decision IDs in DECISION-LOG.md.
- Evidence records carry level (code, registration, reach, runtime), kind
  (repo-file or external), source, location and summary; external evidence needs
  a revision. Rules need code-level evidence for an existing owner, registration
  evidence for a registration claim, reach evidence for each path that reaches
  or bypasses, and runtime evidence for "runtime verified".
- Repository evidence files are read by the check: missing, changed (against an
  optional sha256) or stale evidence blocks Development-Ready.
- Resolved blocking questions need a resolution; PO/BA ones also an approved
  decision. Supersede links must point to a superseded decision. Rule
  dependencies must resolve.
- PATH_CONFLICT when a rule claims a path the PBI scope excludes.

### Product
- The wizard and `-Action CheckPbi` show the approval basis once a PBI is Ready
  for Review. Results are identical in both (50 shared scenarios plus the four
  3.0.0 gap states, JSON compared field by field).
- The agent, readiness guide and template describe the new flow: revalidate after
  every change, resolve PO/BA and technical questions with their owners, one
  consolidated review quoting the fingerprints, separate approvals, final document
  only when the check allows it. The guide separates code-enforced controls from
  controls that depend on the agent.
- Template: execution-path scope table, criteria as one verbatim column, evidence
  level column, approval fingerprints line.

### Other fixes found in review
- Paths with Windows device names (CON, NUL.cs, COM1...) or a trailing dot or
  space are rejected in the wizard and the installer; Windows silently aliased
  them to other files.
- PowerShell property lookup is now case-sensitive, as in JavaScript, so
  `"Rules"` is no longer read as `"rules"` by one implementation only.

### Unchanged
One agent, on-demand v2.0/v2.1 comparison baselines, wizard, PowerShell installer,
manifest, conflict handling, backups and rollback. No new dependencies.

## 3.0.0 — 27 October 2026

### Agent and refinement
- One agent, "Akzo SDD PBI Builder - <project>", replaces the original/Concise pair.
  The concise communication rules are kept. "Dynamic" is removed from all names.
- Execution-path ownership: four separate evidence levels (code exists, registration
  or configuration active, target request reaches it, runtime confirmed). Plugin
  source alone is not treated as active.
- Validation ownership matrix (`VALIDATION-MATRIX.md`) per business rule, and CDMS
  versus DAB/OCP/GraphQL decided per operation from evidence.
- Users and permissions: initiator, role/ownership/BU scope, execution identity,
  record/field restrictions, unauthorized behavior; frontend visibility is not
  backend authorization.
- Statuses: Draft, Needs Evidence, Awaiting PO/BA Decision, Ready for Review,
  Development-Ready.
- Final revalidation of all rules and criteria, then one consolidated approval request
  (PO/BA, technical, final user). `REFINED-PBI.md` is created only after all three
  approvals are recorded; drafts live in `DRAFT-PBI.md`. A change to an approved item
  bumps its `rev` and needs renewed approval.
- Better questions: business example, options with consequences, no re-asking an
  answered question, answers recorded with scope and provenance.
- New PBIs start with no decisions or approvals from other PBIs.
- On-demand guides in `playbook/pbi-builder/skills/`: execution-path analysis,
  readiness and approval, repository knowledge.
- PBI template extended (actors, current vs required behavior, ownership summary,
  CDMS vs DAB, integration failures, data/state, AC-to-rule links, readiness).

### Deterministic checks
- `pbi-state.json` and a readiness check (form button, `-Action CheckPbi`) with
  shared rules: completeness, evidence gaps, reuse of inactive/bypassed enforcement,
  identities, PBI-specific decisions, stale approvals, document consistency, and
  no final document before approval. It never claims semantic correctness or
  approval authenticity.
- Repository knowledge: `knowledge/evidence-index.json` with content fingerprints of
  raw bytes; refresh marks changed or deleted sources stale (form button,
  `-Action RefreshEvidence`). Reference documents get a heading index.

### Installation
- Windows installer: `Install-PBIBuilder.cmd/.ps1`, `Uninstall-PBIBuilder.cmd/.ps1`
  with folder selection, settings, preview, install, upgrade, verify, repair and
  uninstall. Same manifest, hashes, backups, conflict detection and rollback as the
  form. Respects execution policy.
- Generation contract: `core.js` exports a placeholder bundle
  (`pbi-builder-bundle.json`, schemaVersion 1) that both installers render. Unknown
  schemas, tokens and placeholders fail before writing.
- Migration retires unchanged 2.x agent files after the new ones are verified;
  edited or unowned ones are kept and reported.
- Comparison trials write a pinned v2.0 Original or v2.1 Concise baseline agent
  on demand; Remove comparison agents deletes unchanged ones.

### Maintenance
- `build.py` and `update-fixture.py` read and write UTF-8 with LF on Windows
  (previously failed with cp1252 and wrote CRLF).
- Tests: 24 core checks, UI handler smoke, 6 PowerShell equivalence and installer
  checks; `compare-versions.cjs`; `release.cjs` builds and verifies the ZIP.

## 2.1.0 — 28 September 2026
Concise pilot agent added beside the original 2.0 agent; comparison mode.

## 2.0.0
Setup wizard: project-specific agent, intake, continuation, managed updates.
