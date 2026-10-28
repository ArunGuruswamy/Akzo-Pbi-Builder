AKZO SDD PBI BUILDER 4.0.0
Evidence-based PBI refinement | 27 October 2026

WHAT IT DOES
One Copilot agent per repository: "Akzo SDD PBI Builder - <your project>".
It refines PBIs from source evidence, one business question at a time. For each
business rule it records who enforces it today (plugin, workflow, application,
API, UI or configuration), whether that enforcement is registered and active, and
whether CDMS and DAB/OCP/GraphQL requests reach it, with evidence for each claim.
It asks for PO/BA, technical and final user approval in ONE summary before it
creates the final REFINED-PBI.md. Each approval is bound to a fingerprint of what
was reviewed; any later change makes it stale and needs renewed approval.

INSTALL - OPTION A: BROWSER (no PowerShell needed)
1. Extract this ZIP (Extract All). Open Akzo-SDD-PBI-Builder.html from the
   extracted folder in desktop Edge or Chrome.
2. Click Choose project folder and select your application repository root.
3. Check Project name, Editor and repository role. Add other source paths if needed.
4. Click Review setup. When upgrading, check Allow reviewed updates only after
   reviewing the list. Click Install / update in selected folder.
5. Reopen the solution (Visual Studio) or folder (VS Code). In Copilot Chat select
   Akzo SDD PBI Builder - <your project>, then run the setup-check prompt shown.

INSTALL - OPTION B: WINDOWS SETUP WINDOW
Double-click Install-PBIBuilder.cmd. A setup window opens:
1. Add repository... and choose the repository root (the folder with .git).
   The list shows each repository's installed version and whether an update is
   available; it is remembered for next time.
2. For a first install choose the editor and what the repository is (CDMS,
   DAB (GraphQL) or Custom (Legacy CRM/XRM)); an upgrade keeps its settings.
3. Install / Upgrade shows the planned changes and asks before writing.
   Upgrade all does the same for every listed repository with an older version.
   Repair, Verify and Uninstall work on the selected repository.
Files you edited are never overwritten (that repository is skipped and
reported); replaced files are backed up first. Or run the installer with
parameters, for example:
  Install-PBIBuilder.cmd -RepoPath "C:\src\My Repo" -ProjectName "My Repo" -Ide vscode -Role dab -Preview
  Install-PBIBuilder.cmd -RepoPath "C:\src\My Repo" -AllowUpdates
  (the older ColorDMS analysis documents are not installed unless you add -IncludeReferences;
  the agent investigates the repository directly and never needs them)
  powershell -File PBI-Builder-Setup.ps1 -NoGui -Action Upgrade   (all listed repositories)
Actions: -Action Install (default), Verify, Repair, Uninstall, CheckPbi,
RefreshEvidence. -Preview shows changes without writing. Uninstall-PBIBuilder.cmd
removes setup files but always keeps PBIs, decisions, history and knowledge notes.
Both options write identical files for the same settings.
The installer respects your PowerShell execution policy and never bypasses it.
If the policy blocks it, ask IT or use Option A. Do not change the policy yourself.

CREATE A PBI
Open a NEW Copilot chat for every new PBI, so nothing from an earlier PBI is
carried over. In Copilot type "Create PBI", or use the New PBI tab of the form. The
agent asks, in one message, only for what is missing: the PBI number or title, the
requirement, and optionally the investigation scope. It then investigates the source
on its own and asks only genuine business decisions, each with a recommendation,
numbered choices and a ready-to-use answer (Business Decision Advisor skill). There
is no DAB plugin: DAB implements every applicable legacy rule in its own code, while
CDMS reuses verified plugins. Answers can also be given on the form's Continue tab.
See docs/USER-GUIDE.md.

UPGRADING FROM 3.1.0
Install as above and allow reviewed updates (in the setup window: Install /
Upgrade or Upgrade all). Existing PBIs and approvals stay
valid. See MIGRATION.md.

UPGRADING FROM 3.0.0
Install as above and allow reviewed updates. PBI folders are not changed. 3.0.0
approvals cannot show what was reviewed, so the check no longer accepts them: a
3.0.0 PBI must be migrated by the agent and approved again before it is
Development-Ready. See MIGRATION.md.

UPGRADING FROM 2.0 OR 2.1
Install as above. The earlier "dynamic" and "Concise" agent files are backed up and
removed only if you never edited them; edited ones are kept and listed. Existing
PBIs, decisions and history are untouched. See MIGRATION.md.

DAILY USE
In Copilot select the agent and type "Create PBI", "Resume PBI <number>",
"Continue PBI <number or folder>" or "Refine PBI <number>: <what changed>".
Other commands: Review, Edit, Show Decisions, Analyze Legacy, Analyze Workflows,
Extract Plugin Rules, Show Technical
Flow, Generate Acceptance Criteria, Export and Validate PBI <number>. The form's New PBI and Continue PBI tabs
remain available. Before final approval, run Check PBI readiness (form) or
  Install-PBIBuilder.cmd -RepoPath "C:\src\My Repo" -Action CheckPbi -Pbi <folder>
When the PBI is ready for review, the check prints the approval basis the agent
records with each approval. It checks completeness and consistency, not business
correctness or who approved.

COMPARE WITH AN EARLIER VERSION
Compare old & new in the form adds a pinned v2.0 Original or v2.1 Concise agent for
one trial, with identical requests and separate output folders. Remove it afterwards
with Remove comparison agents. See COMPARE-OLD-AND-NEW.txt.

WHEN FOLDER ACCESS IS BLOCKED
Use Option B, or Download setup ZIP in the form and copy its CONTENTS into the
repository root (including .github), comparing existing files first. The manual
copy has no managed-update protection.

PREREQUISITES
Visual Studio 2026 18.4+ for custom agents, or VS Code with Copilot. Copilot
sign-in and the read/search/edit tools. Access to the application source.
No npm, API key, admin rights, network calls or new dependencies.

PROTECTION AND LIMITATIONS
Never replaced: application code, solution files, .github/copilot-instructions.md,
unrelated agents, PBIs, knowledge notes, user-edited setup files. Updates use
content hashes and backups; file operations are not a multi-file transaction.
Nothing is committed, pushed, published to Azure DevOps or sent to anyone.
Instructions guide the model; they cannot guarantee its output. Readiness and
approval records are checked for completeness, never authenticated.

VALIDATION
See VALIDATION.txt and MEASUREMENTS.md. Live Copilot quality, agent discovery and
native browser dialogs still need a first team-machine check.
