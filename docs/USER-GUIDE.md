# Akzo SDD PBI Builder 4.0: user guide

You do not need to know the templates, the code or terms such as CDMS, DAB, plugins or
workflows. Describe what you need; the builder asks only for business decisions.

## Create a PBI
**In Copilot.** Select "Akzo SDD PBI Builder - <your project>" and type `Create PBI`. You can
also type New PBI, Create User Story, Refine New Requirement or Start PBI. The agent needs only
three things, and asks for them in one message when they are missing:

1. the PBI number or title;
2. the requirement or acceptance criteria, in your own words (pasted Azure DevOps text, rules or
   code are fine);
3. optionally, the investigation scope, for example "legacy only".

If your first message already contains them, the agent asks nothing and starts. It works out the
rest itself (kind of change, application areas, draft acceptance criteria, attachments) and shows
it in its first progress summary for you to correct. It then investigates the source on its own:
it does not ask whether to look at the next rule, file or JavaScript. You hear from it at
milestones and when a real business decision is needed.

"Target project" is the repository where the Builder is installed and the PBI is saved. The
application being investigated is established from the requirement and the source.

**In the form.** Open `playbook/pbi-builder/PBI-Builder.html`, or the package's
`Akzo-SDD-PBI-Builder.html`. The **New PBI** tab collects the same details on a few pages,
including the optional investigation scope. Its file picker copies
your attachments into the PBI's `attachments` folder. **Save draft** keeps unfinished work.
**Start analysis** saves the intake and gives you the prompt to paste into Copilot.

If a PBI with the same number exists, you are offered Resume (it is selected for you on the
Continue tab) or **Create a separate draft**. Nothing is overwritten.

## Answer business questions
After investigating, the agent asks only genuine business decisions: one at a time, or up to three
related ones together. It uses the **Business Decision Advisor** skill
(`.github/skills/business-decision-advisor/SKILL.md`). Each question shows:
- what happens today, what the requirement expects and what is missing;
- its recommendation and why;
- numbered choices: the recommended option, alternatives, then Custom answer and Decide later;
- a ready-to-use answer you can approve as written;
- the implementation impact and the source evidence.

Answer with the number. Options are never letters.

| Where | How you answer |
| --- | --- |
| VS Code | Choose an option in the question control Copilot shows, or type a custom answer |
| Visual Studio, or when no control appears | Type `1`, `2`, `3`… (the last two are "Custom answer" and "Decide later"); `back` edits your previous answer, `status` shows progress, `why` explains the question |
| The form, Continue tab, **Answer business questions** | Load questions, pick an answer or write a custom one, enter your name, Submit. The recommended option is preselected. Edit previous answer and Decide later are there too; a required question left for later keeps the PBI from being Development-Ready |

How answers are recorded:
- Your answer is saved immediately with your name and the time. It approves that one decision,
  not the whole PBI.
- Changing an answer keeps the earlier one as superseded history.
- Answered questions are never asked again unless the requirement changes.
- The agent does not ask business users about plugin registration, pipelines, builds,
  repositories or deployment. Missing technical evidence goes into the technical assessment.

## Other commands
| Command | What it does |
| --- | --- |
| `Resume PBI 305915` | Continues a draft or the next open question |
| `Review PBI 305915` | Summarizes status, decisions and open questions |
| `Edit PBI 305915` | Changes details or an earlier answer |
| `Show Decisions 305915` | Lists decisions with who, when and what they replaced |
| `Analyze Legacy 305915` | Explains how the legacy CRM process works, with file and line evidence |
| `Show Technical Flow 305915` | The traced call chain |
| `Extract Plugin Rules 305915 FormulaPlugin` | Reads the plugin code and writes PLUGIN-RULES.md: each validation and business rule with its condition, exact error message, data needed, whether DAB must implement it, and test cases. Asks first if the PBI excludes legacy evidence |
| `Analyze Workflows 305915 Create Paint System` | Traces the classic CRM workflows and custom workflow activities on that operation and writes PLUGIN-WORKFLOW-COVERAGE.md: which rules plugins, workflows or custom activities already handle (and how sure that is), and what DAB must do. Follows the PBI's scope: CDMS, DAB or Both |
| `Generate Acceptance Criteria 305915` | Proposed Given/When/Then criteria for review |
| `Export PBI 305915` | The final PBI if allowed, otherwise the draft clearly marked |
| `Validate PBI 305915` | Explains the readiness check result |

These are phrases for the agent, not editor commands. The number can also be a title or folder.

## Attachments: what to expect
- The agent reads what its tools can open: text, Markdown, source files and usually images
  attached in chat.
- If it cannot open a file (for example some PDF or Word files), it says so and asks for text or
  an export. It never guesses a file's content.
- Nothing in an attachment counts as an approved requirement just because it is written there.

## Finishing a PBI
When all questions are answered, the agent:
1. revalidates everything;
2. asks you to run **Check PBI readiness** (Continue tab) or
   `Install-PBIBuilder.cmd -RepoPath <repo> -Action CheckPbi -Pbi <folder>`;
3. presents one consolidated approval request (PO/BA, technical, final user).

`REFINED-PBI.md`, `CDMS-REFINED-PBI.md` and `DAB-REFINED-PBI.md` are created only when the
check allows it, and only for the applications you chose. The check confirms completeness and
consistency; it cannot confirm that the content is right or who really approved.

## CDMS, DAB and the legacy rules
The agent reads the legacy code (plugins, workflows, custom workflow activities, JavaScript,
HTML web resources and ribbon commands) and lists every business rule once, with all the places
it was found, in VALIDATION-MATRIX.md. Ask for LEGACY-BUSINESS-RULE-CATALOG.md or
BUSINESS-RULE-OWNERSHIP.md if you want them as separate documents.

## The repository is the source of truth
PBI -> repository discovery -> source investigation -> business-rule validation -> gaps ->
decisions only when blocked -> readiness -> refined PBI and SDD handoff.

The agent reads the application repository itself. It never needs, writes or waits for a separate
end-to-end analysis document. Older analysis documents, including the ColorDMS reports the form
can still install on request, are optional background: never a prerequisite, never evidence of
current behavior, and never deleted by the Builder. Every investigation checks the current code
again. Findings go, briefly and with file references, into EVIDENCE.md and VALIDATION-MATRIX.md.

Required per PBI: REQUEST.md, DRAFT-PBI.md, VALIDATION-MATRIX.md, EVIDENCE.md, DECISION-LOG.md,
OPEN-QUESTIONS.md, pbi-state.json and the final refined PBI. Only on request: PLUGIN-RULES.md,
PLUGIN-WORKFLOW-COVERAGE.md, the rule catalog, shared rules, ownership and acceptance-criteria
documents, and the developer handoff export.

- **CDMS:** a rule an existing CRM plugin already handles (with its registration checked) is
  reused; the PBI says to verify it, not to build it again. Workflow and JavaScript rules are
  included as CDMS API work or verification.
- **DAB:** there is no DAB plugin. Every applicable rule is a DAB requirement, implemented in DAB's
  own code (Azure Functions, CQRS handlers, FluentValidation for input checks, domain services,
  GraphQL). The PBI says what DAB already has, what is partial and what is missing.
- **Both:** one shared set of business rules and decisions, and two separate application PBIs.

Every rule is checked branch by branch (for example Yes and No, failure and rollback). A plugin
that handles the Yes path does not make the rule covered; a missing No path is reported as a
gap with its risk and a proposed approach.

## Handing over to development
On the Continue tab, select the PBI and click **Export developer handoff**. It writes
`business-rules.json` (for the development agent) and `BRANCH-COVERAGE-MATRIX.md` from the PBI's
recorded state, and keeps earlier exports in `history/`. The file separates approved
requirements, proposed requirements and technical findings, and lists every open gap.

Legacy code tells the agent what DAB must do; it never proves what DAB already does. If an
earlier decision left legacy evidence out of a PBI, it stays until you change it.

## Visual Studio: what the agent can read
In Visual Studio, Copilot's agent file tools read only files in the open solution, or in the
opened folder and its subfolders (Microsoft: "Use Agent Mode", FAQ). A repository next to it, such
as `..\AN.ColorDMS.Customizations`, is out of reach unless the folder you open contains it. The
agent checks this before every analysis, reports a source it cannot read as "configured but
inaccessible" (never as missing), and says which conclusions stay unverified.

Repository-level agents are found in the `.github\agents` folder at the repository root, and
skills in `.github\skills` (Visual Studio 18.5 or later; Microsoft Learn, "Use Agent Skills").
Install the Builder at the Git root (the folder with `.git`); the installer warns otherwise.

The agent searches the whole repository, not only the loaded solution. A repository can hold
several solutions, for example plugins in one and JavaScript web resources in a sibling one;
open the repository root as a folder so all of them are reachable. **Discover sources** lists
every solution and, per folder, the kinds of files it holds, including JavaScript that no project
lists. To name the folders that matter in one repository, create
`playbook\pbi-builder\knowledge\SEARCH-SCOPE.md` yourself, for example:

```
# Search scope
- Source/Formula
- Source/WebResources
- Source/Measurement
- Source/MarketColor
```

The installer never writes or overwrites it. Before saying a feature is missing, the agent searches
every relevant layer and reports each finding as found and verified, found but not yet reviewed,
not found within the listed searches, or inaccessible.

| Analysis | Install the Builder into | Role / sources | Open in Visual Studio |
| --- | --- | --- | --- |
| Custom (Legacy CRM/XRM) only | the legacy repository | role `legacy`, legacy source `.` | File > Open > Folder on the repository root (a `.sln` in a subfolder would leave the root, and the Builder's `playbook\` folder, outside the agent's reach) |
| DAB (GraphQL) only | the DAB repository | role `dab`, DAB source `.` | the repository root folder |
| CDMS only | the CDMS repository | role `cdms`, CDMS source `.` | the repository root folder |
| Several repositories | the repository you work in; other sources as relative paths (`../Legacy`) | as above | a common parent folder that contains every clone. Not verified yet: whether Visual Studio still lists an agent stored in a child repository when the opened folder is the parent. Check it with the list below; if the agent does not appear, analyse from each repository in turn |

Never copy application source into the Builder's folders; the Builder reads it where it is.

**Discover sources** (Continue tab of the form) writes `playbook\pbi-builder\knowledge\SOURCE-MAP.md`:
solutions, projects, project references, target frameworks, markers (CRM SDK, workflows, Web
Forms, Azure Functions, GraphQL, FluentValidation, data access) and whether each configured source
could be read. It reads only solution and project files and counts the rest; it never copies
code or configuration values. Run it again when projects change.

### Visual Studio check (once per team machine)
1. Install the Builder (form or `Install-PBIBuilder.cmd`) into the repository, then open the folder
   as in the table.
2. Copilot Chat > agent picker: "Akzo SDD PBI Builder - <project>" is listed (Visual Studio 18.4 or
   later).
3. Select it, open the **Tools** panel and confirm `readfile`, `code_search`, `find_references` and
   `editfiles` are available and enabled (Microsoft notes that custom-agent tool groups can start
   disabled; re-enable them there).
4. Ask: "Check source access." It should name each source as readable, configured but inaccessible
   or not configured, quoting one file it actually read.
5. For several repositories, repeat steps 2 to 4 with the parent folder open.
