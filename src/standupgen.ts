/**
 * standupgen core: draft a factual standup from supplied
 * git commits and pull request activity.
 *
 *   generateStandup(args) -> { standup, counts }
 *
 * Rendering (pinned by the spec; lines joined with "\n", no
 * trailing newline; sections separated by exactly one blank
 * line):
 *
 *   - First line: "## Standup — <date_label>" (date_label
 *     defaults to "Yesterday").
 *   - "### Done", present when there is at least one
 *     included commit or merged pull request: commit lines
 *     first, in input order, as "- <subject> (<short hash>)"
 *     where the short hash is the first 7 characters of the
 *     hash (the full hash when shorter); then merged pull
 *     request lines, sorted by number ascending, as
 *     "- Merged #<number>: <title>".
 *   - "### In progress", present when any included pull
 *     request has state opened or updated: lines sorted by
 *     number ascending, as "- #<number>: <title> (<state>)".
 *   - "### Closed without merging", present when any
 *     included pull request has state closed: lines sorted
 *     by number ascending, as "- #<number>: <title>".
 *   - When no section exists, the standup is the heading
 *     line, a blank line, and "No recorded activity.".
 *
 * Filtering (pinned): when the top-level `author` argument
 * is given, a commit or pull request is included only when
 * its own `author` field is present and exactly equals it —
 * records without an author are excluded. Counts and
 * rendering both use the filtered sets.
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path (for example
 * "pull_requests[1].number must be an integer >= 1") and no
 * partial result is produced.
 */
import type {
  StandupCommit,
  StandupCounts,
  StandupPullRequest,
  StandupPullRequestState,
  StandupResult,
} from "./types.js";

export const VERSION = "0.1.0";

const DEFAULT_DATE_LABEL = "Yesterday";
const PR_STATES: readonly StandupPullRequestState[] = [
  "opened",
  "updated",
  "merged",
  "closed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function optionalAuthor(raw: Record<string, unknown>, path: string): string | undefined {
  if (raw.author === undefined) return undefined;
  return nonEmptyString(raw.author, `${path}.author`);
}

function validateCommits(rawList: unknown[]): StandupCommit[] {
  return rawList.map((entry, i) => {
    const path = `commits[${i}]`;
    if (!isRecord(entry)) throw new Error(`${path} must be an object`);
    if (entry.hash === undefined) throw new Error(`${path}.hash is required`);
    const hash = nonEmptyString(entry.hash, `${path}.hash`);
    if (entry.subject === undefined) throw new Error(`${path}.subject is required`);
    const subject = nonEmptyString(entry.subject, `${path}.subject`);
    const author = optionalAuthor(entry, path);
    const commit: StandupCommit = { hash, subject };
    if (author !== undefined) commit.author = author;
    return commit;
  });
}

function validatePullRequests(rawList: unknown[]): StandupPullRequest[] {
  const indexByNumber = new Map<number, number>();
  return rawList.map((entry, i) => {
    const path = `pull_requests[${i}]`;
    if (!isRecord(entry)) throw new Error(`${path} must be an object`);
    if (entry.number === undefined) throw new Error(`${path}.number is required`);
    if (
      typeof entry.number !== "number" ||
      !Number.isInteger(entry.number) ||
      entry.number < 1
    ) {
      throw new Error(`${path}.number must be an integer >= 1`);
    }
    const firstIndex = indexByNumber.get(entry.number);
    if (firstIndex !== undefined) {
      throw new Error(
        `${path}.number duplicates pull_requests[${firstIndex}].number ${entry.number}`,
      );
    }
    indexByNumber.set(entry.number, i);
    if (entry.title === undefined) throw new Error(`${path}.title is required`);
    const title = nonEmptyString(entry.title, `${path}.title`);
    if (entry.state === undefined) throw new Error(`${path}.state is required`);
    if (
      typeof entry.state !== "string" ||
      !PR_STATES.includes(entry.state as StandupPullRequestState)
    ) {
      throw new Error(
        `${path}.state must be one of "opened", "updated", "merged", "closed"`,
      );
    }
    const author = optionalAuthor(entry, path);
    const pr: StandupPullRequest = {
      number: entry.number,
      title,
      state: entry.state as StandupPullRequestState,
    };
    if (author !== undefined) pr.author = author;
    return pr;
  });
}

/**
 * Validate the raw arguments object and return the
 * normalised (unfiltered) commits, pull requests, the
 * optional author filter, and the effective date label.
 */
function validateArgs(args: unknown): {
  commits: StandupCommit[];
  pullRequests: StandupPullRequest[];
  author: string | undefined;
  dateLabel: string;
} {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.commits !== undefined && !Array.isArray(raw.commits)) {
    throw new Error("commits must be an array");
  }
  if (raw.pull_requests !== undefined && !Array.isArray(raw.pull_requests)) {
    throw new Error("pull_requests must be an array");
  }

  let author: string | undefined;
  if (raw.author !== undefined) {
    author = nonEmptyString(raw.author, "author");
  }

  let dateLabel = DEFAULT_DATE_LABEL;
  if (raw.date_label !== undefined) {
    dateLabel = nonEmptyString(raw.date_label, "date_label");
  }

  const commits = validateCommits(
    Array.isArray(raw.commits) ? raw.commits : [],
  );
  const pullRequests = validatePullRequests(
    Array.isArray(raw.pull_requests) ? raw.pull_requests : [],
  );

  return { commits, pullRequests, author, dateLabel };
}

function byNumber(a: StandupPullRequest, b: StandupPullRequest): number {
  return a.number - b.number;
}

/** Draft the standup from the supplied activity records. */
export function generateStandup(args: unknown): StandupResult {
  const { commits: allCommits, pullRequests: allPrs, author, dateLabel } =
    validateArgs(args);

  const commits =
    author === undefined
      ? allCommits
      : allCommits.filter((c) => c.author !== undefined && c.author === author);
  const pullRequests =
    author === undefined
      ? allPrs
      : allPrs.filter((p) => p.author !== undefined && p.author === author);

  const merged = pullRequests.filter((p) => p.state === "merged").sort(byNumber);
  const inProgress = pullRequests
    .filter((p) => p.state === "opened" || p.state === "updated")
    .sort(byNumber);
  const closed = pullRequests.filter((p) => p.state === "closed").sort(byNumber);

  const counts: StandupCounts = {
    commits: commits.length,
    merged: merged.length,
    in_progress: inProgress.length,
    closed: closed.length,
  };

  const heading = `## Standup — ${dateLabel}`;
  const sections: string[] = [];

  if (commits.length > 0 || merged.length > 0) {
    const lines = ["### Done"];
    for (const commit of commits) {
      lines.push(`- ${commit.subject} (${commit.hash.slice(0, 7)})`);
    }
    for (const pr of merged) {
      lines.push(`- Merged #${pr.number}: ${pr.title}`);
    }
    sections.push(lines.join("\n"));
  }
  if (inProgress.length > 0) {
    const lines = ["### In progress"];
    for (const pr of inProgress) {
      lines.push(`- #${pr.number}: ${pr.title} (${pr.state})`);
    }
    sections.push(lines.join("\n"));
  }
  if (closed.length > 0) {
    const lines = ["### Closed without merging"];
    for (const pr of closed) {
      lines.push(`- #${pr.number}: ${pr.title}`);
    }
    sections.push(lines.join("\n"));
  }

  const standup =
    sections.length === 0
      ? `${heading}\n\nNo recorded activity.`
      : [heading, ...sections].join("\n\n");

  return { standup, counts };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
