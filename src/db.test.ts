import { describe, it, expect } from "vitest";
import { removeUndefined } from "./db";

describe("removeUndefined", () => {
  it("strips undefined top-level keys", () => {
    expect(removeUndefined({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  it("strips undefined keys in nested objects", () => {
    expect(removeUndefined({ a: { b: undefined, c: 2 } })).toEqual({ a: { c: 2 } });
  });

  it("recurses into arrays of objects", () => {
    expect(removeUndefined([{ a: undefined, b: 1 }, { a: 2, b: undefined }])).toEqual([{ b: 1 }, { a: 2 }]);
  });

  it("preserves null values (does not strip them)", () => {
    expect(removeUndefined({ a: null, b: 1 })).toEqual({ a: null, b: 1 });
  });

  it("converts a top-level undefined input to null", () => {
    expect(removeUndefined(undefined)).toBeNull();
  });

  it("leaves primitives untouched", () => {
    expect(removeUndefined(5)).toBe(5);
    expect(removeUndefined("text")).toBe("text");
    expect(removeUndefined(null)).toBeNull();
  });

  it("handles deeply nested mixed structures", () => {
    const input = {
      resume: {
        contact: { name: "Jane", website: undefined },
        experience: [
          { company: "Acme", endDate: undefined, bullets: ["a", undefined as any, "b"] },
        ],
      },
    };
    expect(removeUndefined(input)).toEqual({
      resume: {
        contact: { name: "Jane" },
        experience: [{ company: "Acme", bullets: ["a", null, "b"] }],
      },
    });
  });
});
