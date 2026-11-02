import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateStandup } from "../src/standupgen.js";

/**
 * All tests are pure local computation over inline activity
 * records: no filesystem, no network. The rendering pins are
 * each given a dedicated test: the short hash is the first
 * 7 characters (the full hash when shorter), commits come
 * before merged pull requests inside Done, pull requests
 * are sorted by number within their sections, empty sections
 * are omitted, an empty day renders "No recorded activity.",
 * the author filter excludes records with no author field,
 * counts are taken over the filtered sets, and a duplicate
 * pull request number errors naming the second occurrence.
 */

type Rec = Record<string, unknown>;

const commit = (over: Rec = {}): Rec => ({
  hash: "0123456789abcdef",
  subject: "Ship the thing",
  ...over,
});

const pr = (over: Rec = {}): Rec => ({
  number: 10,
  title: "A pull request",
  state: "merged",
  ...over,
});

describe("generateStandup — heading and defaults", () => {
  it("the heading uses the default date label 'Yesterday'", () => {
    const out = generateStandup({ commits: [commit()] });
    assert.ok(out.standup.startsWith("## Standup — Yesterday\n"));
  });

  it("a custom date_label replaces the heading label", () => {
    const out = generateStandup({
      commits: [commit()],
      date_label: "Tuesday, Oct 27",
    });
    assert.ok(out.standup.startsWith("## Standup — Tuesday, Oct 27\n"));
  });

  it("omitted commits and pull_requests default to empty", () => {
    const out = generateStandup({});
    assert.deepEqual(out.counts, { commits: 0, merged: 0, in_progress: 0, closed: 0 });
  });

  it("the standup has no trailing newline", () => {
    const out = generateStandup({ commits: [commit()] });
    assert.ok(!out.standup.endsWith("\n"));
    const empty = generateStandup({});
    assert.ok(!empty.standup.endsWith("\n"));
  });

  it("sections are separated by exactly one blank line", () => {
    const out = generateStandup({
      commits: [commit()],
      pull_requests: [pr({ number: 3, state: "opened" })],
    });
    assert.ok(!out.standup.includes("\n\n\n"));
    assert.equal(
      out.standup,
      "## Standup — Yesterday\n\n### Done\n- Ship the thing (0123456)\n\n### In progress\n- #3: A pull request (opened)",
    );
  });

  it("unknown extra fields are ignored (pinned judgement call)", () => {
    const out = generateStandup({
      commits: [{ hash: "abcdef123456", subject: "S", mood: "great" }],
      extra: true,
    });
    assert.equal(out.counts.commits, 1);
  });
});

describe("generateStandup — rendering pins", () => {
  it("short hash is the first 7 characters of the hash", () => {
    const out = generateStandup({
      commits: [commit({ hash: "a1b2c3d4e5f6", subject: "Work" })],
    });
    assert.ok(out.standup.includes("- Work (a1b2c3d)"));
    assert.ok(!out.standup.includes("a1b2c3d4"));
  });

  it("a hash shorter than 7 characters is rendered in full", () => {
    const out = generateStandup({
      commits: [commit({ hash: "abc12", subject: "Tiny" })],
    });
    assert.ok(out.standup.includes("- Tiny (abc12)"));
  });

  it("a hash of exactly 7 characters is rendered as itself", () => {
    const out = generateStandup({
      commits: [commit({ hash: "1234567", subject: "Exact" })],
    });
    assert.ok(out.standup.includes("- Exact (1234567)"));
  });

  it("commits come before merged PRs inside Done, commits in input order", () => {
    const out = generateStandup({
      commits: [
        commit({ hash: "1111111aaaa", subject: "Second entered" }),
        commit({ hash: "2222222bbbb", subject: "First alphabetically" }),
      ],
      pull_requests: [pr({ number: 1, title: "Merged one", state: "merged" })],
    });
    assert.equal(
      out.standup,
      "## Standup — Yesterday\n\n### Done\n" +
        "- Second entered (1111111)\n" +
        "- First alphabetically (2222222)\n" +
        "- Merged #1: Merged one",
    );
  });

  it("merged PR lines read '- Merged #<number>: <title>'", () => {
    const out = generateStandup({
      pull_requests: [pr({ number: 7, title: "Fix it", state: "merged" })],
    });
    assert.ok(out.standup.includes("### Done\n- Merged #7: Fix it"));
  });

  it("PRs are sorted by number ascending within Done", () => {
    const out = generateStandup({
      pull_requests: [
        pr({ number: 30, title: "Thirty", state: "merged" }),
        pr({ number: 5, title: "Five", state: "merged" }),
        pr({ number: 12, title: "Twelve", state: "merged" }),
      ],
    });
    const done = out.standup.split("### Done\n")[1];
    assert.deepEqual(done.split("\n"), [
      "- Merged #5: Five",
      "- Merged #12: Twelve",
      "- Merged #30: Thirty",
    ]);
  });

  it("PRs are sorted by number ascending within In progress", () => {
    const out = generateStandup({
      pull_requests: [
        pr({ number: 9, title: "Nine", state: "updated" }),
        pr({ number: 2, title: "Two", state: "opened" }),
      ],
    });
    assert.equal(
      out.standup,
      "## Standup — Yesterday\n\n### In progress\n- #2: Two (opened)\n- #9: Nine (updated)",
    );
  });

  it("PRs are sorted by number ascending within Closed without merging", () => {
    const out = generateStandup({
      pull_requests: [
        pr({ number: 8, title: "Eight", state: "closed" }),
        pr({ number: 4, title: "Four", state: "closed" }),
      ],
    });
    assert.equal(
      out.standup,
      "## Standup — Yesterday\n\n### Closed without merging\n- #4: Four\n- #8: Eight",
    );
  });

  it("in-progress lines carry the state in parentheses", () => {
    const out = generateStandup({
      pull_requests: [
        pr({ number: 1, title: "Fresh", state: "opened" }),
        pr({ number: 2, title: "Touched", state: "updated" }),
      ],
    });
    assert.ok(out.standup.includes("- #1: Fresh (opened)"));
    assert.ok(out.standup.includes("- #2: Touched (updated)"));
  });

  it("closed lines carry no state suffix", () => {
    const out = generateStandup({
      pull_requests: [pr({ number: 6, title: "Dropped", state: "closed" })],
    });
    assert.ok(out.standup.includes("- #6: Dropped"));
    assert.ok(!out.standup.includes("(closed)"));
  });

  it("a Done section exists for merged PRs alone, with no commits", () => {
    const out = generateStandup({
      pull_requests: [pr({ state: "merged" })],
    });
    assert.ok(out.standup.includes("### Done"));
    assert.equal(out.counts.commits, 0);
    assert.equal(out.counts.merged, 1);
  });

  it("the full standup matches exactly for a mixed day", () => {
    const out = generateStandup({
      date_label: "Monday",
      commits: [
        { hash: "aaaaaaa0000", subject: "Alpha work", author: "rene" },
        { hash: "bb", subject: "Beta work" },
      ],
      pull_requests: [
        { number: 20, title: "Merged twenty", state: "merged" },
        { number: 3, title: "Open three", state: "opened" },
        { number: 15, title: "Updated fifteen", state: "updated" },
        { number: 9, title: "Closed nine", state: "closed" },
      ],
    });
    assert.equal(
      out.standup,
      "## Standup — Monday\n\n" +
        "### Done\n" +
        "- Alpha work (aaaaaaa)\n" +
        "- Beta work (bb)\n" +
        "- Merged #20: Merged twenty\n\n" +
        "### In progress\n" +
        "- #3: Open three (opened)\n" +
        "- #15: Updated fifteen (updated)\n\n" +
        "### Closed without merging\n" +
        "- #9: Closed nine",
    );
    assert.deepEqual(out.counts, { commits: 2, merged: 1, in_progress: 2, closed: 1 });
  });
});

describe("generateStandup — section omission", () => {
  it("Done is omitted when there are no commits and no merged PRs", () => {
    const out = generateStandup({
      pull_requests: [pr({ state: "opened" })],
    });
    assert.ok(!out.standup.includes("### Done"));
    assert.ok(out.standup.includes("### In progress"));
  });

  it("In progress is omitted when no PR is opened or updated", () => {
    const out = generateStandup({
      pull_requests: [pr({ state: "merged" }), pr({ number: 11, state: "closed" })],
    });
    assert.ok(!out.standup.includes("### In progress"));
    assert.ok(out.standup.includes("### Closed without merging"));
  });

  it("Closed without merging is omitted when no PR is closed", () => {
    const out = generateStandup({ commits: [commit()] });
    assert.ok(!out.standup.includes("### Closed without merging"));
    assert.ok(!out.standup.includes("### In progress"));
  });
});

describe("generateStandup — 'No recorded activity.' fallback", () => {
  it("empty input renders the heading, a blank line, and the fallback", () => {
    const out = generateStandup({});
    assert.equal(out.standup, "## Standup — Yesterday\n\nNo recorded activity.");
  });

  it("explicitly empty lists render the fallback with a custom label", () => {
    const out = generateStandup({ commits: [], pull_requests: [], date_label: "Friday" });
    assert.equal(out.standup, "## Standup — Friday\n\nNo recorded activity.");
    assert.deepEqual(out.counts, { commits: 0, merged: 0, in_progress: 0, closed: 0 });
  });

  it("a filter that matches nothing renders the fallback", () => {
    const out = generateStandup({
      author: "nobody",
      commits: [commit({ author: "rene" })],
    });
    assert.equal(out.standup, "## Standup — Yesterday\n\nNo recorded activity.");
  });
});

describe("generateStandup — author filter", () => {
  const data = () => ({
    commits: [
      commit({ hash: "1111111x", subject: "Rene commit", author: "rene" }),
      commit({ hash: "2222222x", subject: "Ana commit", author: "ana" }),
      commit({ hash: "3333333x", subject: "Anon commit" }),
    ],
    pull_requests: [
      pr({ number: 1, title: "Rene merged", state: "merged", author: "rene" }),
      pr({ number: 2, title: "Ana open", state: "opened", author: "ana" }),
      pr({ number: 3, title: "Anon closed", state: "closed" }),
    ],
  });

  it("only the named author's commits and PRs are included", () => {
    const out = generateStandup({ ...data(), author: "rene" });
    assert.ok(out.standup.includes("- Rene commit (1111111)"));
    assert.ok(out.standup.includes("- Merged #1: Rene merged"));
    assert.ok(!out.standup.includes("Ana"));
    assert.ok(!out.standup.includes("Anon"));
  });

  it("records with no author field are excluded by the filter", () => {
    const out = generateStandup({ ...data(), author: "rene" });
    assert.ok(!out.standup.includes("Anon commit"));
    assert.ok(!out.standup.includes("Anon closed"));
    assert.equal(out.counts.commits, 1);
    assert.equal(out.counts.closed, 0);
  });

  it("the match is exact: a different case does not match", () => {
    const out = generateStandup({ ...data(), author: "Rene" });
    assert.equal(out.standup, "## Standup — Yesterday\n\nNo recorded activity.");
  });

  it("counts are taken over the filtered sets", () => {
    const out = generateStandup({ ...data(), author: "ana" });
    assert.deepEqual(out.counts, { commits: 1, merged: 0, in_progress: 1, closed: 0 });
    const all = generateStandup(data());
    assert.deepEqual(all.counts, { commits: 3, merged: 1, in_progress: 1, closed: 1 });
  });

  it("without a filter, records with and without authors are all included", () => {
    const out = generateStandup(data());
    assert.ok(out.standup.includes("Anon commit"));
    assert.ok(out.standup.includes("Anon closed"));
  });
});

describe("generateStandup — counts", () => {
  it("in_progress counts opened plus updated", () => {
    const out = generateStandup({
      pull_requests: [
        pr({ number: 1, state: "opened" }),
        pr({ number: 2, state: "updated" }),
        pr({ number: 3, state: "updated" }),
        pr({ number: 4, state: "merged" }),
        pr({ number: 5, state: "closed" }),
      ],
    });
    assert.deepEqual(out.counts, { commits: 0, merged: 1, in_progress: 3, closed: 1 });
  });

  it("counts match the rendered sections", () => {
    const out = generateStandup({
      commits: [commit(), commit({ hash: "9999999z", subject: "More" })],
      pull_requests: [pr({ number: 1, state: "merged" })],
    });
    assert.deepEqual(out.counts, { commits: 2, merged: 1, in_progress: 0, closed: 0 });
  });
});

describe("generateStandup — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => generateStandup(args), { message });

  it("commits present but not an array is an error", () => {
    throws({ commits: "yesterday" }, "commits must be an array");
    throws({ commits: 42 }, "commits must be an array");
  });

  it("pull_requests present but not an array is an error", () => {
    throws({ pull_requests: {} }, "pull_requests must be an array");
    throws({ pull_requests: null }, "pull_requests must be an array");
  });

  it("a commit entry that is not an object names its path", () => {
    throws({ commits: ["abc"] }, "commits[0] must be an object");
    throws({ commits: [commit(), null] }, "commits[1] must be an object");
  });

  it("a pull request entry that is not an object names its path", () => {
    throws({ pull_requests: [7] }, "pull_requests[0] must be an object");
  });

  it("hash missing names its path", () => {
    throws({ commits: [{ subject: "S" }] }, "commits[0].hash is required");
  });

  it("hash empty or non-string names its path", () => {
    throws({ commits: [commit({ hash: "" })] }, "commits[0].hash must be a non-empty string");
    throws({ commits: [commit({ hash: 123 })] }, "commits[0].hash must be a non-empty string");
  });

  it("subject missing, empty, or non-string names its path", () => {
    throws({ commits: [{ hash: "abc" }] }, "commits[0].subject is required");
    throws({ commits: [commit({ subject: "" })] }, "commits[0].subject must be a non-empty string");
    throws(
      { commits: [commit(), commit({ subject: false })] },
      "commits[1].subject must be a non-empty string",
    );
  });

  it("number missing names its path", () => {
    throws(
      { pull_requests: [{ title: "T", state: "opened" }] },
      "pull_requests[0].number is required",
    );
  });

  it("number not an integer or below 1 names its path", () => {
    for (const bad of [0, -2, 1.5, "3", true, null]) {
      throws(
        { pull_requests: [pr({ number: bad })] },
        "pull_requests[0].number must be an integer >= 1",
      );
    }
  });

  it("number 1 is valid", () => {
    const out = generateStandup({ pull_requests: [pr({ number: 1 })] });
    assert.equal(out.counts.merged, 1);
  });

  it("a duplicate PR number errors naming the second occurrence's path", () => {
    throws(
      {
        pull_requests: [
          pr({ number: 5, title: "First" }),
          pr({ number: 9, title: "Other" }),
          pr({ number: 5, title: "Again", state: "opened" }),
        ],
      },
      "pull_requests[2].number duplicates pull_requests[0].number 5",
    );
  });

  it("duplicate numbers error even across different states", () => {
    assert.throws(() =>
      generateStandup({
        pull_requests: [
          pr({ number: 4, state: "merged" }),
          pr({ number: 4, state: "closed" }),
        ],
      }),
    );
  });

  it("title missing, empty, or non-string names its path", () => {
    throws(
      { pull_requests: [{ number: 1, state: "opened" }] },
      "pull_requests[0].title is required",
    );
    throws({ pull_requests: [pr({ title: "" })] }, "pull_requests[0].title must be a non-empty string");
    throws({ pull_requests: [pr({ title: 9 })] }, "pull_requests[0].title must be a non-empty string");
  });

  it("state missing names its path", () => {
    throws(
      { pull_requests: [{ number: 1, title: "T" }] },
      "pull_requests[0].state is required",
    );
  });

  it("state outside the enum names its path", () => {
    throws(
      { pull_requests: [pr({ state: "pending" })] },
      'pull_requests[0].state must be one of "opened", "updated", "merged", "closed"',
    );
    throws(
      { pull_requests: [pr({ state: "Merged" })] },
      'pull_requests[0].state must be one of "opened", "updated", "merged", "closed"',
    );
    throws(
      { pull_requests: [pr({ state: 3 })] },
      'pull_requests[0].state must be one of "opened", "updated", "merged", "closed"',
    );
  });

  it("every enum state is accepted", () => {
    for (const state of ["opened", "updated", "merged", "closed"]) {
      const out = generateStandup({ pull_requests: [pr({ state })] });
      assert.equal(
        out.counts.merged + out.counts.in_progress + out.counts.closed,
        1,
      );
    }
  });

  it("an item-level commit author present but empty or non-string names its path", () => {
    throws({ commits: [commit({ author: "" })] }, "commits[0].author must be a non-empty string");
    throws({ commits: [commit({ author: 5 })] }, "commits[0].author must be a non-empty string");
  });

  it("an item-level PR author present but empty or non-string names its path", () => {
    throws(
      { pull_requests: [pr({ author: "" })] },
      "pull_requests[0].author must be a non-empty string",
    );
    throws(
      { pull_requests: [pr({ author: null })] },
      "pull_requests[0].author must be a non-empty string",
    );
  });

  it("a top-level author present but empty or non-string is an error", () => {
    throws({ author: "" }, "author must be a non-empty string");
    throws({ author: 12 }, "author must be a non-empty string");
  });

  it("date_label present but empty or non-string is an error", () => {
    throws({ date_label: "" }, "date_label must be a non-empty string");
    throws({ date_label: 2026 }, "date_label must be a non-empty string");
  });

  it("no partial result is produced on invalid input", () => {
    assert.throws(() =>
      generateStandup({
        commits: [commit()],
        pull_requests: [pr({ number: 0 })],
      }),
    );
  });
});
