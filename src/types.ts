/**
 * standupgen types.
 *
 * standupgen drafts a factual standup from activity the
 * caller supplies: git commits and pull request activity.
 * From that data alone, as pure local computation, it
 * renders a short Markdown standup:
 *
 *   - a heading labelled with the supplied date label
 *   - a Done section: the commits, then the merged pull
 *     requests
 *   - an In progress section: the pull requests that were
 *     opened or updated
 *   - a Closed without merging section: the pull requests
 *     that were closed
 *   - counts of each kind of activity, over the same
 *     (possibly author-filtered) sets the text was rendered
 *     from
 *
 * The standup is a draft built only from the records handed
 * in: nothing here reads a repository, queries a hosting
 * service, or invents activity that was not supplied.
 */

/** One commit to report, as supplied by the caller. */
export interface StandupCommit {
  /** Commit hash; rendered as its first 7 characters. */
  hash: string;
  /** Commit subject line. */
  subject: string;
  /** Commit author. Optional. */
  author?: string;
}

/** What happened to a pull request. */
export type StandupPullRequestState = "opened" | "updated" | "merged" | "closed";

/** One pull request activity record, as supplied by the caller. */
export interface StandupPullRequest {
  /** Pull request number; at least 1, unique across the set. */
  number: number;
  /** Pull request title. */
  title: string;
  /** What happened to the pull request. */
  state: StandupPullRequestState;
  /** Pull request author. Optional. */
  author?: string;
}

/** Counts of the filtered activity, by kind. */
export interface StandupCounts {
  /** Included commits. */
  commits: number;
  /** Included pull requests with state "merged". */
  merged: number;
  /** Included pull requests with state "opened" or "updated". */
  in_progress: number;
  /** Included pull requests with state "closed". */
  closed: number;
}

/** The drafted standup and its counts. */
export interface StandupResult {
  /** The rendered standup text (lines joined with "\n", no trailing newline). */
  standup: string;
  /** Activity counts over the filtered sets. */
  counts: StandupCounts;
}
