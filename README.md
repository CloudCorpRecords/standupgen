# standupgen

A standup written from memory drifts toward whatever felt
biggest, and quietly drops the small fixes that actually
shipped. standupgen takes the opposite approach: you hand
it the activity records — git commits and pull request
activity — and it drafts the standup from exactly those
records, nothing added and nothing embellished. The result
is factual, local, and yours to edit before you paste it
anywhere.

The rendered standup is short Markdown with up to three
sections:

- **Done** — every commit you supplied, in the order you
  supplied them, each shown with the first 7 characters of
  its hash, followed by the merged pull requests sorted by
  number.
- **In progress** — pull requests whose state is `opened`
  or `updated`, sorted by number, each tagged with its
  state.
- **Closed without merging** — pull requests whose state
  is `closed`, sorted by number.

A section with nothing in it is left out entirely. When
there is no activity at all, the standup is just the
heading and "No recorded activity.". Alongside the text,
the result carries counts — commits, merged, in progress,
closed — so the numbers and the prose always agree.

An optional `author` filter narrows the standup to one
person: only commits and pull requests whose own `author`
field is present and matches exactly are included, and the
counts are taken over that filtered set. Records without
an author never survive the filter. The heading label
defaults to "Yesterday" and can be set with `date_label`.

Malformed input — a list that is not an array, an entry
that is not an object, a missing, empty, or non-string
hash, subject, or title, a pull request number that is
missing, not an integer, below 1, or duplicated, a state
outside `opened` / `updated` / `merged` / `closed`, an
empty author or date label — is a validation error naming
the offending path (for example
`pull_requests[1].number must be an integer >= 1`), and no
partial standup is produced. The computation is pure and
local: no network, no configuration, and no repository is
read — only the records you pass in.

## CLI

```bash
npx @reneturcios/standupgen generate --input args.json
npx @reneturcios/standupgen --version
```

`args.json` contains the full arguments object:

```json
{
  "date_label": "Yesterday",
  "commits": [
    { "hash": "a1b2c3d4e5", "subject": "Fix retry backoff", "author": "rene" },
    { "hash": "f6e7d8c9b0", "subject": "Add export button", "author": "rene" }
  ],
  "pull_requests": [
    { "number": 42, "title": "Retry backoff", "state": "merged", "author": "rene" },
    { "number": 43, "title": "Dark mode", "state": "opened", "author": "rene" },
    { "number": 40, "title": "Old experiment", "state": "closed", "author": "rene" }
  ]
}
```

`commits` and `pull_requests` are both optional and
default to empty. The output object is printed as JSON:

```json
{
  "standup": "## Standup — Yesterday\n\n### Done\n- Fix retry backoff (a1b2c3d)\n- Add export button (f6e7d8c)\n- Merged #42: Retry backoff\n\n### In progress\n- #43: Dark mode (opened)\n\n### Closed without merging\n- #40: Old experiment",
  "counts": { "commits": 2, "merged": 1, "in_progress": 1, "closed": 1 }
}
```

Rendered, the standup reads:

## Standup — Yesterday

### Done
- Fix retry backoff (a1b2c3d)
- Add export button (f6e7d8c)
- Merged #42: Retry backoff

### In progress
- #43: Dark mode (opened)

### Closed without merging
- #40: Old experiment

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or invalid
input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/standupgen mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "standupgen": {
      "command": "npx",
      "args": ["-y", "@reneturcios/standupgen", "mcp"]
    }
  }
}
```

### Tools

- `generate_standup` — Draft a factual standup from git
  commits and pull request activity.
  - `commits` (array, optional, default `[]`) — commits as
    `{hash, subject, author?}` objects; `hash` is rendered
    as its first 7 characters
  - `pull_requests` (array, optional, default `[]`) — pull
    requests as `{number, title, state, author?}` objects;
    `number` is a positive integer unique across the set
    and `state` is one of `opened`, `updated`, `merged`,
    `closed`
  - `author` (string, optional) — when given, only this
    author's commits and pull requests are included (exact
    match); records without an author are excluded
  - `date_label` (string, optional, default `"Yesterday"`)
    — label for the standup heading

  Returns `{standup, counts}` where `counts` is
  `{commits, merged, in_progress, closed}` over the
  filtered sets.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/standupgen
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/standupgen generate --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
