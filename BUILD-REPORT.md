# standupgen — Build Report

MCP Rebuild 1000, Batch 16. Original program build from the
packages-100 plan (cluster H #92), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch16/standupgen.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `standupgen`, npm `@reneturcios/standupgen`,
MCP name `io.github.CloudCorpRecords/standupgen`, version
`0.1.0`, bin `standupgen` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Draft a
  factual standup from the git commits and pull request
  activity you supply." — 82 chars, verified by count; npm
  entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/standupgen:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/standupgen"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`generate --input
  <args.json>` where the file holds the full arguments
  object, `mcp`, `--version`; exit 2 usage / 1 runtime
  error, argument validation before any file read),
  `src/mcp.ts`, `src/types.ts`, `src/standupgen.ts` (core,
  `VERSION = "0.1.0"`)
- `test/standupgen.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/standupgen`,
  smoke-test server-name assertion `standupgen`)
- Plus the parity fixture at
  `harness/fixtures/standupgen-tools-original.json`
  (`_source` labelling it a program spec from the
  packages-100 plan, cluster H #92; the `state` field
  carries the enum `["opened", "updated", "merged",
  "closed"]` exactly as in the spec's schema literal).

## Tools implemented (1)

- `generate_standup` — arguments: `commits` (array,
  optional, default []) of `{hash (string, required,
  non-empty), subject (string, required, non-empty),
  author (string, optional, non-empty)}`,
  `pull_requests` (array, optional, default []) of
  `{number (integer, required, >= 1, unique across the
  set), title (string, required, non-empty), state
  (string, required, enum opened / updated / merged /
  closed), author (string, optional, non-empty)}`, plus
  `author` (string, optional, non-empty) and `date_label`
  (string, optional, non-empty, default "Yesterday").

  Rendering is pinned by the spec: first line
  `## Standup — <date_label>`; a `### Done` section (when
  any included commit or merged PR exists) with commit
  lines first in input order as `- <subject> (<short
  hash>)` — the short hash is the first 7 characters of
  the hash, the full hash when shorter — then merged PR
  lines sorted by number ascending as
  `- Merged #<number>: <title>`; a `### In progress`
  section (any included PR opened or updated) sorted by
  number as `- #<number>: <title> (<state>)`; a
  `### Closed without merging` section (any included PR
  closed) sorted by number as `- #<number>: <title>`.
  Lines are joined with "\n", there is no trailing
  newline, and sections are separated by exactly one blank
  line. When no section exists the standup is the heading,
  a blank line, and `No recorded activity.`.

  Returns `{standup, counts}` where counts = `{commits,
  merged, in_progress, closed}` (in_progress counts opened
  + updated), all over the filtered sets. Filtering is
  pinned: when the top-level `author` is given, a record is
  included only when its own `author` field is present and
  exactly equals it, so records without an author are
  excluded. The computation is pure and local.

  The fixture literal
  (`harness/fixtures/standupgen-tools-original.json`) and
  the `src/mcp.ts` literal are identical under the
  harness's canonicalisation, with no `$schema` and no
  `additionalProperties` — confirmed by the parity run
  below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object (`{commits?, pull_requests?, author?,
  date_label?}`).
- Validation is path-naming and total: a list present but
  not an array, an entry that is not an object, a missing /
  empty / non-string `hash`, `subject`, or `title`, a
  missing, non-integer, or sub-1 `number`, a missing
  `state` or one outside the enum, an empty or non-string
  `author` (item-level or top-level) or `date_label`
  throws an Error naming the offending path and produces
  no partial result (MCP: `isError`; CLI: exit 1). A
  duplicated PR number names the second occurrence's path,
  in the fleet's wording pattern adapted to numbers:
  `pull_requests[<i>].number duplicates
  pull_requests[<first>].number <n>`. Validation order (a
  pinned judgement call, see Gaps): the two lists'
  shape first, then the top-level `author`, then
  `date_label`, then commit entries, then pull request
  entries.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **52 tests,
  52 pass, 0 fail** — the heading and `date_label`
  default/custom; no trailing newline; exactly one blank
  line between sections; the rendering pins as dedicated
  tests (short hash = first 7 characters, full hash when
  shorter than 7, exactly-7 hash unchanged, commits before
  merged PRs inside Done with commits in input order, PR
  sorting by number ascending within Done / In progress /
  Closed without merging, in-progress state suffix present
  and closed lines carrying none, a full exact-text match
  for a mixed day); section omission for each section;
  the "No recorded activity." fallback for empty input,
  explicitly empty lists, and a filter matching nothing;
  the author filter (only exact matches included, records
  with no author field excluded, case-sensitive,
  unfiltered input includes authorless records); counts
  over filtered sets and in_progress counting opened +
  updated; and every validation path (non-array lists,
  non-object entries, missing/empty/non-string `hash` /
  `subject` / `title`, missing `number`, non-integer /
  sub-1 / non-number `number`, the duplicate-number error
  naming the second occurrence — including duplicates
  across different states, missing `state` and states
  outside the enum including a wrongly-cased one, all
  four enum states accepted, item-level and top-level
  `author` empty/non-string, `date_label` empty/non-string,
  and no partial result on invalid input).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  all 15 `dist/` outputs, every file non-zero bytes.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `generate` with no `--input` exits 2;
  `generate --input <missing file>` exits 1 naming the
  file; `generate --input <valid file>` exits 0 and prints
  the output JSON (verified against a hand-checked set: a
  commit rendered with its 7-char short hash under Done, a
  merged PR after it, an opened PR under In progress, a
  closed PR under Closed without merging, counts
  `{commits: 1, merged: 1, in_progress: 1, closed: 1}`);
  `generate --input <invalid file>` (duplicate PR number)
  exits 1 with `pull_requests[1].number duplicates
  pull_requests[0].number 5`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/standupgen-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build dir with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/standupgen`, **128 package entries**.
Resolved versions match the batch-15 reference tree:
`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43, `qs` 6.17.0.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated
  test or a note above): (1) validation order — the
  lists' shape is checked first, then the top-level
  `author` and `date_label`, then individual entries, so
  a bad `date_label` is reported even when a commit is
  also malformed; (2) unknown extra fields, at the top
  level and per entry, are ignored rather than rejected
  (the spec does not forbid them); (3) a non-object
  top-level arguments value is treated as an empty
  object, so it renders the "No recorded activity."
  fallback (both lists are optional, so an empty object
  is valid input); (4) duplicate-number wording is not
  fixed by the spec (only that the error names the second
  occurrence's path); the message used is
  `pull_requests[<i>].number duplicates
  pull_requests[<first>].number <n>`, matching the fleet
  pattern. The spec's stated server.json description
  count (82 chars) was verified exact this time. No other
  spec ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
