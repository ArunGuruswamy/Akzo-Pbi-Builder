# Akzo SDD PBI Builder 4.0: user guide

You do not need to know the templates, the code or terms such as CDMS, DAB, plugins or
workflows. Describe what you need; the builder asks only for business decisions.

## Create a PBI
**In Copilot.** Select "Akzo SDD PBI Builder - <your project>" and type `Create PBI`. You can
also type New PBI, Create User Story, Refine New Requirement or Start PBI. The agent guides you
through six short steps:

1. **Title.** Optionally add the PBI number and choose the target project from the configured
   list.
2. **What should the application do?** Use your own words. Pasted Azure DevOps text, rules or
   code are fine.
3. **Acceptance criteria.** Enter them, let the agent draft them for review, point to an
   attachment, or skip for now.
4. **Supporting material.** Documents, spreadsheets, screenshots, diagrams or source files.
5. **Kind of change.** New feature, enhancement, fix, legacy migration or not sure, plus notes.
6. **Review.** Then choose Edit details, Save draft, Start analysis or Cancel.

If your first message already contains the requirement, the agent fills in those steps and asks
only for what is missing.

**In the form.** Open `playbook/pbi-builder/PBI-Builder.html`, or the package's
`Akzo-SDD-PBI-Builder.html`. The **New PBI** tab has the same six steps. Its file picker copies
your attachments into the PBI's `attachments` folder. **Save draft** keeps unfinished work.
**Start analysis** saves the intake and gives you the prompt to paste into Copilot.

If a PBI with the same number exists, you are offered Resume (it is selected for you on the
Continue tab) or **Create a separate draft**. Nothing is overwritten.

## Answer business questions
After analysis the agent asks one business question at a time. Each question shows:
- why it matters;
- a short example;
- two to four options;
- a custom answer.

| Where | How you answer |
| --- | --- |
| VS Code | Choose an option in the question control Copilot shows, or type a custom answer |
| Visual Studio, or when no control appears | Type `1`, `2`, `3`… (the last number is "custom answer"); `back` edits your previous answer, `skip` skips an optional question, `status` shows progress, `why` explains the question |
| The form, Continue tab, **Answer business questions** | Load questions, pick an answer or write a custom one, enter your name, Submit. Edit previous answer and Skip (optional questions only) are there too |

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

`REFINED-PBI.md` is created only when the check allows it. The check confirms completeness and
consistency; it cannot confirm that the content is right or who really approved.

## Legacy evidence and DAB
For a DAB/OCP/GraphQL PBI, legacy CRM plugin behavior is background only; it never proves what
DAB does. If you tell the agent to leave legacy plugins out of a PBI's analysis, it records that
once as a decision and does not challenge it again.
