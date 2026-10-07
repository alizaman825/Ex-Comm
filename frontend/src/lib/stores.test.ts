import { describe, expect, it } from "vitest";
import { problemsSentence, reasonText, storeProblems } from "./stores";

describe("reasonText", () => {
  it.each([
    ["TIMEOUT", /took too long/],
    ["BLOCKED", /refused the request/],
    ["CIRCUIT_OPEN", /paused for a few minutes.*Refresh/],
    ["BUDGET", /time limit/],
    ["HTTP", /error/],
    ["PARSE", /could not read/],
  ])("%s", (code, re) => expect(reasonText({ code })).toMatch(re));

  it("falls back to the raw message for unknown errors, shortened", () => {
    expect(reasonText({ error: "getaddrinfo ENOTFOUND www.daraz.pk" })).toBe("could not be reached: getaddrinfo ENOTFOUND www.daraz.pk");
    expect(reasonText({ error: "x".repeat(300) }).length).toBeLessThan(120);
    expect(reasonText({})).toBe("could not be reached");
  });
});

describe("storeProblems", () => {
  it("lists only the stores that did not answer, with reasons", () => {
    const problems = storeProblems({ daraz: { status: "failed", code: "TIMEOUT" }, priceoye: { status: "success", relevant: 3 } });
    expect(problems).toEqual([{ platform: "daraz", label: "Daraz", text: "took too long to answer" }]);
    expect(problemsSentence(problems)).toBe("Daraz took too long to answer");
  });

  it("is empty when everyone answered, even with zero matches", () => {
    expect(storeProblems({ daraz: { status: "success", relevant: 0 }, priceoye: { status: "success", relevant: 0 } })).toEqual([]);
    expect(storeProblems(undefined)).toEqual([]);
  });

  it("treats a store that ran out of time with nothing found as a problem, but not one that found results first", () => {
    expect(storeProblems({ daraz: { status: "success", code: "BUDGET", relevant: 0 } })).toHaveLength(1);
    expect(storeProblems({ daraz: { status: "success", code: "BUDGET", relevant: 5 } })).toHaveLength(0);
  });

  it("joins several stores", () => {
    const text = problemsSentence(storeProblems({ daraz: { status: "failed", code: "TIMEOUT" }, priceoye: { status: "skipped", code: "CIRCUIT_OPEN" } }));
    expect(text).toContain("Daraz took too long to answer; PriceOye is paused");
  });
});
