# Changelog

## 4.0.0 — 27 October 2026

### Every new PBI starts fresh
- Agent: each new PBI uses only its own request, folder, attachments and the source read for
  it. Start it in a new chat (the agent asks for one if the conversation already worked on
  another PBI); nothing is carried over from earlier PBIs, chats or Copilot memory (rules,
  answers, decisions, assumptions, field values, application names, questions, criteria).
  Other PBI folders are read only by name for duplicate detection, or as a named related PBI
  that is never evidence or approval. PBI content is never stored in Copilot memory or
  knowledge notes. The start prompt of every new PBI repeats this.
- Readiness (form and PowerShell, identical): evidence that points into another PBI's folder is
  reported as FOREIGN_PBI_EVIDENCE and never counts; files in the PBI's own folder still do.

### Setup window with upgrade
- Double-clicking Install-PBIBuilder.cmd opens a setup window (PBI-Builder-Setup.ps1),
  modelled on the Akzo Master SDD installer: a remembered list of repositories with each one's
  installed version and available update, Add repository, Install / Upgrade, Upgrade all,
  Repair, Verify, Uninstall and a log. Editor and repository area are asked only for a first
  install; an upgrade keeps config.json.
- It runs Install-PBIBuilder.ps1 for every action, so review, conflict protection, backups and
  rollback are unchanged: changes are previewed and confirmed before writing, and a repository
  with edited files is skipped and reported. It runs under the user's execution policy (no
  Bypass, unlike the Master installer). `-NoGui -Action Install|Upgrade|Repair|Verify|Uninstall|Status`
  for scripts. The list is stored in %USERPROFILE%\.akzo-pbi-builder\repositories.txt (paths
  only). With arguments, Install-PBIBuilder.cmd runs the installer as before.

### Application areas and question rules
- Three application areas, named the same everywhere: CDMS, DAB (GraphQL) and Custom (Legacy
  CRM/XRM). Stored keys are unchanged (`legacy`, `dab`, `cdms`; evidence system `legacy-crm`),
  so existing configurations and PBIs keep working. The form's repository role and source
  labels, sources.yaml (`area` per source) and SOURCE-MAP.md use these names.
- Agent: identify the current repository's area from its source, search the source before
  describing functionality, name the owning area for each rule, trace across the available
  areas, explain in business language. Never invent an application, repository or dependency;
  a field value such as OwnColor (Development Tool) is data, not an application, and is kept as
  written.
- Questions: options in business language with a Recommended option and its reason (when
  supported), Custom answer and Decide later. A scope question (area, workflow, process or field
  value) only after finding where the field or behavior is used and whether the requirement
  covers all of those places. For PBI 277355 this removes the question "Should the Yes/No
  choice apply to ColorApps or both ColorApps and OwnColor?"; the agent now investigates where
  the Development Tool field affects actualization across the Industrialization workflows.
- Form: Decide later replaces Skip and also works on required questions; they stay open and the
  PBI is not Development-Ready until they are answered. A question's `recommended` option is
  marked and preselected.

### Guided PBI creation
- "Create PBI" (also New PBI, Create User Story, Refine New Requirement, Start PBI): six
  steps (title and project, requirement, acceptance criteria, supporting material, kind of
  change, review) with prefill from what the user already gave, Save draft and Resume.
- The form's New PBI tab is the same wizard: progress, Back/Next, Save draft, Start analysis,
  Cancel, target project from the configured sources, a real file picker that copies
  attachments into the PBI's attachments/ folder, and Resume or Create separate draft when the
  PBI number already exists (previously a hard stop).
- Commands: Resume, Review, Edit, Show Decisions, Analyze Legacy, Show Technical Flow,
  Generate Acceptance Criteria, Export and Validate PBI.

### Visual Studio source access and discovery
- Checked against Microsoft's Visual Studio documentation: custom agents live in
  `.github/agents/*.agent.md` (Visual Studio 18.4+); documented tool names include `readfile`,
  `code_search`, `editfiles` and `find_references`; agent file tools reach only the open
  solution or opened folder and its subfolders. The Visual Studio agent now also has
  `find_references` (read-only caller tracing); no terminal tool. Pinned comparison agents keep
  their original tools.
- Agent and repository-knowledge guide: source access check before every analysis (readable,
  configured but inaccessible, not configured, proven by a real file read; never "missing"),
  solution and project mapping, tracing from entry point to persistence and side effects for
  legacy .NET Framework, Web Forms, plugins, workflows, web resources, SQL and configuration (no
  secrets recorded), evidence priority (current source first, bundled reports last), and
  SOURCE-DISCOVERY.md per PBI; pbi-state.json may record `sourceAccess`.
- Readiness: bundled reports under playbook/pbi-builder/references/ (or evidence marked
  `historical`) never count as evidence; `HISTORICAL_NOT_PROOF` when a rule has nothing else.
- Form: Discover sources writes knowledge/SOURCE-MAP.md and source-map.json (solutions, projects,
  references, frameworks, markers, file kinds, access per source); reads only solution and project
  files. The developer handoff now carries `sourceAccess` and `dependencies`.
- sources.yaml states the Visual Studio access rule; user guide: setups for legacy, DAB, CDMS and
  several repositories, and a Visual Studio check.

### Branch completeness, developer handoff and speed
- New mandatory guide `skills/business-rule-branch-completeness.md`: conditions, Yes/No
  branches, success, validation failures, status transitions, side effects, failure and
  rollback, compared per branch with verified implementation; side-effect risk when an
  uncovered branch shares an operation with a covered one (worked example: Paint System
  measurement, Yes replaces Master measurement and Color Point, No keeps them).
- Rules may record `branches` with CDMS and DAB coverage (covered, partial, missing,
  conflicting, unverified, not-applicable), evidence, risk, proposed approach and acceptance
  criteria. Readiness: `BRANCH_INCOMPLETE`, `BRANCH_NOT_COVERED` (reuse claimed while a branch
  such as No is open), `BRANCH_COVERAGE_UNPROVEN` (covered without code evidence, without plugin
  activation, or with legacy evidence for DAB), `DAB_BRANCH_GAP`. Same results in PowerShell.
- Form: Export developer handoff writes `business-rules.json` (schema 1: applications, rules,
  branches, recorded and effective coverage, evidence, CDMS and DAB ownership, acceptance
  criteria, decisions, open gaps; approved requirements, proposed requirements and technical
  findings kept apart) and `BRANCH-COVERAGE-MATRIX.md`, from pbi-state.json only; earlier exports
  go to history/.
- Faster refinement instructions: configured paths are never asked for, search terms come from
  the PBI, no whole-repository scans, only the needed guides, incremental updates after an
  answer, a short default summary, and per-run metrics in EVIDENCE.md. The evidence index can
  hold method, entity, trigger, conditions, rule IDs, calls and confidence.
- Compare old & new: results.csv adds files_read, cache_entries_reused and cold_or_warm.
  `maintainer/benchmark.cjs` measures the deterministic operations against 3.1.0
  (docs/PERFORMANCE.md).

### Business rule ownership (CDMS and DAB)
- There is no DAB plugin. DAB implements every applicable legacy rule in its own code; the
  earlier "the plugin already runs for DAB" and "assign only some legacy operations to DAB"
  wording is removed. New guide `skills/business-rule-ownership.md`: application choice (CDMS,
  DAB or Both, asked once and saved); rules read from plugins, workflows, custom activities,
  JavaScript (OnLoad/OnSave/OnChange, ribbon), HTML web resources and helpers, with the
  AN.ColorDMS.Customizations areas to search; UI logic restated as API requirements; one
  canonical rule per outcome with every source as evidence; CDMS ownership (existing plugin
  reused when verified, workflow and JavaScript rules included); DAB ownership by layer (Azure
  Functions, CQRS handler, FluentValidation only for input rules, domain service, GraphQL,
  response conventions); documents LEGACY-BUSINESS-RULE-CATALOG.md, SHARED-BUSINESS-RULES.md,
  BUSINESS-RULE-OWNERSHIP.md, ACCEPTANCE-CRITERIA.md, CDMS-REFINED-PBI.md, DAB-REFINED-PBI.md.
- Readiness: a rule may record `dab` {layer, status}; a plugin as DAB layer is
  `DAB_PLUGIN_ASSIGNED`, an incomplete one `DAB_OWNER_INVALID`. With a `dab` record, a CDMS
  `reuse` of a plugin is no longer flagged because DAB bypasses it. Identical rule text is
  `RULE_DUPLICATE`. CDMS-REFINED-PBI.md and DAB-REFINED-PBI.md are gated and checked like
  REFINED-PBI.md, and `DOC_OUT_OF_SCOPE` when their application does not apply. Evidence
  components javascript, web-resource and ribbon.
- Form: the New PBI wizard asks the application (CDMS, DAB, Both, not decided) and saves it in
  REQUEST.md and pbi.json; the start prompt tells the agent not to ask again.
- PBI template: application line and CDMS/DAB ownership columns.

### Business questions
- The agent acts as a Business Analyst. It never asks business users about registration,
  pipelines, DI, middleware, builds, repository paths, GraphQL generation or deployment;
  missing technical evidence goes into the technical assessment and does not stop business
  refinement.
- VS Code: the agent's tools include `vscode/askQuestions` (interactive question controls; the
  host ignores unavailable tools). Elsewhere: numbered options with back, skip, status and why.
- The form's Continue tab has an Answer questions panel: options, custom answer, required
  name, skip (optional questions only), edit previous answer, show decisions.
- Decision engine (core.js): each answer is saved at once to pbi-state.json and DECISION-LOG.md
  with a backup in history/; editing an answer supersedes the earlier decision; the file is not
  written if it changed meanwhile. One answer approves that decision only, without a second
  confirmation.
- Question statuses unanswered, answered, approved, deferred, superseded and not-applicable
  (open and resolved still accepted); identical question text is flagged.

### Evidence
- New guide `skills/crm-plugin-workflow-intelligence.md`: call chains from one entry point with
  a visited list and depth bound, a 10-point record per entry point, evidence per rule, and a
  plain-language presentation (technical evidence, simple explanation, difference, next
  action).
- Evidence records may carry `system` (legacy-crm, cdms, dab, ocp, graphql, other). Legacy CRM
  evidence cannot prove a DAB/OCP/GraphQL path (`LEGACY_NOT_TARGET_EVIDENCE`). A PBI may record
  `evidenceScope` (for example excluding legacy-crm, as directed for PBI 305915) backed by an
  approved decision; excluded evidence is rejected.
- "Extract Plugin Rules <n>": the agent reads the plugin code once and writes PLUGIN-RULES.md,
  a DAB implementation handoff. Each rule is classed as validation, default/calculation, side
  effect or guard, with the trigger, condition as pseudocode, exact error message, data
  needed, CDMS and DAB status, Given/When/Then tests and source lines. DAB need is decided
  from the DAB write path: Web API/SDK writes already run the plugin; direct database writes
  must implement the rule. One business question confirms which rules carry over.
- New guide `skills/xrm-workflow-intelligence.md` and command "Analyze Workflows <n>": classic
  CRM (WF4/XAML) workflows and custom workflow activities, kept apart from Power Automate cloud
  flows. Targeted discovery from the operation's entity (.xaml.data.xml first), trigger, mode,
  scope, activation ("activation unverified" when not shown), branches, actions, child
  workflows, custom activity code, real-time versus background termination, downstream
  triggers with cycle and depth limits, no invented ordering. Writes PLUGIN-WORKFLOW-COVERAGE.md
  (rule, CDMS owner, plugin/workflow, trigger, conditions, evidence, DAB responsibility) with an
  operation graph, and separate business and technical views. CDMS, DAB and Both scopes.
- Rule owners: custom-activity, xrm-service, multiple (with types) and unknown; evidence may name
  its `component`. `OWNER_MISATTRIBUTED` when an owner is not backed by code evidence from that
  component (a workflow rule cited only with plugin code); `OWNER_UNKNOWN` blocks
  Development-Ready. Custom activities need activation evidence like plugins and workflows.
- Faster: a "Work fast" section (targeted searches, line ranges, pbi-state.json first on
  resume) and knowledge/PLUGIN-CATALOG.md so a plugin read for one PBI is reused by the next.

### Compatibility
- pbi-state.json stays schemaVersion 2. A PBI approved under 3.1.0 stays Development-Ready after
  the upgrade (tested). The pinned v2.0/v2.1 comparison agents keep their original tools.
- Results remain identical in the form and PowerShell (61 shared scenarios).

### Not included
- No VS Code extension (Quick Pick/webview); the documented in-chat tool is used instead.
- No Azure DevOps auto-prefill (no approved connection exists); screenshots and documents are
  read by Copilot only where its tools can open them.

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
