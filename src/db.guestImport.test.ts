import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase", () => ({
  db: {},
  auth: { currentUser: null },
}));

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const setDocMock = vi.fn();
const deleteDocMock = vi.fn();
const batchSetMock = vi.fn();
const batchDeleteMock = vi.fn();
const batchCommitMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: any[]) => ({ __type: "doc", segments: args.slice(1) }),
  collection: (...args: any[]) => ({ __type: "collection", segments: args.slice(1) }),
  getDoc: (...args: any[]) => getDocMock(...args),
  getDocs: (...args: any[]) => getDocsMock(...args),
  setDoc: (...args: any[]) => setDocMock(...args),
  deleteDoc: (...args: any[]) => deleteDocMock(...args),
  writeBatch: () => ({ set: batchSetMock, delete: batchDeleteMock, commit: batchCommitMock }),
}));

const { importGuestData, sortHistoryNewestFirst, HISTORY_LIMIT, PRIMARY_RESUME_ID } = await import("./db");

const resume = (name: string) => ({ contact: { name } }) as any;
const entry = (id: string) => ({ id, timestamp: "1/1/2026, 10:00:00 AM", title: `Run ${id}` });

/** Mocks the account side: whether primary exists, and what history it holds. */
function mockAccount(options: { primaryExists?: boolean; history?: { id: string }[] } = {}) {
  const { primaryExists = false, history = [] } = options;
  getDocMock.mockResolvedValue({
    exists: () => primaryExists,
    data: () => (primaryExists ? { data: resume("Existing") } : undefined),
  });
  getDocsMock.mockResolvedValue({ docs: history.map((h) => ({ id: h.id, data: () => h, ref: {} })) });
}

beforeEach(() => {
  getDocMock.mockReset();
  getDocsMock.mockReset();
  setDocMock.mockReset();
  deleteDocMock.mockReset();
  batchSetMock.mockReset();
  batchDeleteMock.mockReset();
  batchCommitMock.mockReset();
});

describe("sortHistoryNewestFirst", () => {
  it("orders by the epoch-ms id prefix, newest first", () => {
    const sorted = sortHistoryNewestFirst([entry("1700000000001"), entry("1700000000003"), entry("1700000000002")]);
    expect(sorted.map((e) => e.id)).toEqual(["1700000000003", "1700000000002", "1700000000001"]);
  });

  it("keeps batch-run ids (`<epoch>_<i>`) grouped with their run", () => {
    const sorted = sortHistoryNewestFirst([entry("1700000000001"), entry("1700000000009_2"), entry("1700000000009_1")]);
    expect(sorted[0].id).toMatch(/^1700000000009/);
    expect(sorted[2].id).toBe("1700000000001");
  });

  it("does not mutate its input", () => {
    const input = [entry("1700000000001"), entry("1700000000002")];
    sortHistoryNewestFirst(input);
    expect(input.map((e) => e.id)).toEqual(["1700000000001", "1700000000002"]);
  });

  it("treats a non-numeric id as oldest instead of throwing", () => {
    const sorted = sortHistoryNewestFirst([entry("not-a-number"), entry("1700000000001")]);
    expect(sorted[0].id).toBe("1700000000001");
  });
});

describe("importGuestData", () => {
  it("writes the guest resume as primary when the account has none", async () => {
    mockAccount({ primaryExists: false });
    const result = await importGuestData("u1", { masterResume: resume("Guest"), versions: [], history: [] });

    expect(result.importedResume).toBe(true);
    const primaryWrite = setDocMock.mock.calls.find((c) => c[0].segments.includes(PRIMARY_RESUME_ID));
    expect(primaryWrite?.[1]).toMatchObject({ name: "Master Resume" });
  });

  it("never overwrites a primary resume the account already has", async () => {
    mockAccount({ primaryExists: true });
    const result = await importGuestData("u1", { masterResume: resume("Guest"), versions: [], history: [] });

    expect(result.importedResume).toBe(false);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("gives imported named versions fresh ids so guest ids cannot collide with account ones", async () => {
    mockAccount({ primaryExists: true });
    const result = await importGuestData("u1", {
      masterResume: null,
      versions: [{ id: "ver_a", name: "Backend", updatedAt: 1700000000000, data: resume("B") }],
      history: [],
    });

    expect(result.importedVersions).toBe(1);
    const writtenId = setDocMock.mock.calls[0][0].segments.at(-1);
    expect(writtenId).not.toBe("ver_a");
    expect(setDocMock.mock.calls[0][1]).toMatchObject({ name: "Backend" });
  });

  it("merges history by id rather than duplicating entries already in the account", async () => {
    mockAccount({ primaryExists: true, history: [entry("1700000000001")] });
    const result = await importGuestData("u1", {
      masterResume: null,
      versions: [],
      history: [entry("1700000000001"), entry("1700000000002")],
    });

    expect(result.importedHistory).toBe(1);
    const writtenIds = batchSetMock.mock.calls.map((c) => c[1].id);
    expect(new Set(writtenIds)).toEqual(new Set(["1700000000001", "1700000000002"]));
  });

  it("is a no-op on history when every guest entry is already present", async () => {
    mockAccount({ primaryExists: true, history: [entry("1700000000001")] });
    const result = await importGuestData("u1", {
      masterResume: null,
      versions: [],
      history: [entry("1700000000001")],
    });

    expect(result.importedHistory).toBe(0);
    expect(batchCommitMock).not.toHaveBeenCalled();
  });

  it("caps the merged history at HISTORY_LIMIT, keeping the newest entries", async () => {
    const accountHistory = Array.from({ length: HISTORY_LIMIT }, (_, i) => entry(String(1700000000000 + i)));
    mockAccount({ primaryExists: true, history: accountHistory });

    const newest = entry(String(1700000000000 + HISTORY_LIMIT + 5));
    const result = await importGuestData("u1", { masterResume: null, versions: [], history: [newest] });

    expect(result.importedHistory).toBe(1);
    const writtenIds = batchSetMock.mock.calls.map((c) => c[1].id);
    expect(writtenIds).toHaveLength(HISTORY_LIMIT);
    expect(writtenIds).toContain(newest.id);
    // The oldest account entry is the one pushed out.
    expect(writtenIds).not.toContain("1700000000000");
  });

  it("does nothing when the guest snapshot is empty", async () => {
    mockAccount({ primaryExists: false });
    const result = await importGuestData("u1", { masterResume: null, versions: [], history: [] });

    expect(result).toEqual({ importedResume: false, importedVersions: 0, importedHistory: 0 });
    expect(setDocMock).not.toHaveBeenCalled();
    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});
