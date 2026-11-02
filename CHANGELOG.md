# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `generate_standup` MCP tool and
  `generate` CLI command drafting a factual standup from
  supplied git commits and pull request activity.
- Rendering pinned to the spec: commits first inside Done
  (in input order, hashes shortened to their first 7
  characters, or the full hash when shorter), then merged
  pull requests by number; opened and updated pull
  requests under In progress and closed ones under Closed
  without merging, each sorted by number; empty sections
  omitted, and "No recorded activity." when nothing
  remains.
- Optional exact-match author filter that excludes records
  carrying no author, with all counts taken over the
  filtered sets.
- Path-naming validation errors for malformed input,
  including a duplicate pull request number naming the
  second occurrence's path.
