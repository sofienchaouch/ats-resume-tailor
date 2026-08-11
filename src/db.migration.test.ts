import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase", () => ({
  db: {},
  auth: { currentUser: null },
}));

const getDocMock = vi.fn();
const batchSetMock = vi.fn();
const batchDeleteMock = vi.fn();
const batchCommitMock = vi.fn();
const writeBatchFactory = vi.fn(() => ({
  set: batchSetMock,
  delete: batchDeleteMock,
  commit: batchCommitMock,
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: any[]) => ({ __type: "doc", segments: args.slice(1) }),
  collection: (...args: any[]) => ({ __type: "collection", segments: args.slice(1) }),
  getDoc: (...args: any[]) => getDocMock(...args),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: () => writeBatchFactory(),
}));

const { migrateToSubcollections, SCHEMA_VERSION } = await import("./db");

beforeEach(() => {
  getDocMock.mockReset();
  batchSetMock.mockReset();
  batchDeleteMock.mockReset();
  batchCommitMock.mockReset();
  writeBatchFactory.mockClear();
});

describe("migrateToSubcollections", () => {
  it("skips migration entirely when already at the current schema version", async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ schemaVersion: SCHEMA_VERSION }) });

    await migrateToSubcollections("user1");

    expect(writeBatchFactory).not.toHaveBeenCalled();
    expect(batchCommitMock).not.toHaveBeenCalled();
  });

  it("runs (and commits) for a brand-new user with no profile doc yet", async () => {
    getDocMock.mockResolvedValue({ exists: () => false, data: () => undefined });

    await migrateToSubcollections("user2");

    expect(writeBatchFactory).toHaveBeenCalledOnce();
    expect(batchCommitMock).toHaveBeenCalledOnce();
    // Only the schemaVersion marker should be set — no legacy data to fan out.
    expect(batchSetMock).toHaveBeenCalledTimes(1);
    expect(batchSetMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schemaVersion: SCHEMA_VERSION }),
      expect.anything()
    );
  });

  it("fans out legacy masterResume, historyList, and jobApplications into subcollection writes", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        masterResume: { contact: { name: "Jane" } },
        historyList: [{ id: "h1", title: "Run 1" }, { id: "h2", title: "Run 2" }],
        jobApplications: [{ id: "a1", company: "Acme" }],
      }),
    });

    await migrateToSubcollections("user3");

    // 1 resume + 2 history + 1 application + 1 schemaVersion marker = 5 batch.set calls.
    expect(batchSetMock).toHaveBeenCalledTimes(5);
    expect(batchCommitMock).toHaveBeenCalledOnce();

    const resumeCall = batchSetMock.mock.calls.find((call) => call[1]?.data?.contact?.name === "Jane");
    expect(resumeCall).toBeDefined();

    const applicationCall = batchSetMock.mock.calls.find((call) => call[1]?.company === "Acme");
    expect(applicationCall).toBeDefined();
    expect(applicationCall![1].resumeId).toBe("primary");

    const schemaCall = batchSetMock.mock.calls.find((call) => call[1]?.schemaVersion === SCHEMA_VERSION);
    expect(schemaCall).toBeDefined();
  });

  it("skips history/application items that are missing an id", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        historyList: [{ title: "No id here" }],
        jobApplications: [{ company: "No id either" }],
      }),
    });

    await migrateToSubcollections("user4");

    // Only the schemaVersion marker should be written — both malformed items skipped.
    expect(batchSetMock).toHaveBeenCalledTimes(1);
  });
});
