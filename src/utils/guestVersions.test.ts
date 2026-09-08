import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory stand-in for the IndexedDB-backed localDb, so these tests exercise
// the version bookkeeping rather than the storage driver.
const store = new Map<string, unknown>();

vi.mock("./localDb", () => ({
  localDb: {
    getItem: async (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback),
    setItem: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    migrateFromLocalStorage: async () => {},
  },
}));

vi.mock("../firebase", () => ({ db: {}, auth: { currentUser: null } }));
vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  collection: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  getDocs: async () => ({ docs: [] }),
  setDoc: async () => {},
  deleteDoc: async () => {},
  writeBatch: () => ({ set: () => {}, delete: () => {}, commit: async () => {} }),
}));

const {
  listGuestResumeVersions,
  getGuestResumeVersion,
  saveGuestResumeVersion,
  renameGuestResumeVersion,
  deleteGuestResumeVersion,
  collectGuestVersions,
  clearGuestResumeData,
  GUEST_MASTER_KEY,
  GUEST_VERSIONS_KEY,
} = await import("./guestVersions");
const { PRIMARY_RESUME_ID } = await import("../db");

const resume = (name: string) => ({ contact: { name } }) as any;

beforeEach(() => {
  store.clear();
});

describe("listGuestResumeVersions", () => {
  it("synthesises a primary entry for guest data created before versions existed", async () => {
    store.set(GUEST_MASTER_KEY, resume("Legacy"));
    const versions = await listGuestResumeVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe(PRIMARY_RESUME_ID);
  });

  it("sorts primary first, then the rest newest-first", async () => {
    store.set(GUEST_VERSIONS_KEY, [
      { id: PRIMARY_RESUME_ID, name: "Master Resume", updatedAt: 1 },
      { id: "ver_old", name: "Old", updatedAt: 1700000000000 },
      { id: "ver_new", name: "New", updatedAt: 1700000009999 },
    ]);

    const versions = await listGuestResumeVersions();
    expect(versions.map((v) => v.id)).toEqual([PRIMARY_RESUME_ID, "ver_new", "ver_old"]);
  });

  it("tolerates a corrupted meta value instead of throwing", async () => {
    store.set(GUEST_VERSIONS_KEY, "not-an-array");
    const versions = await listGuestResumeVersions();
    expect(versions.map((v) => v.id)).toEqual([PRIMARY_RESUME_ID]);
  });
});

describe("saveGuestResumeVersion", () => {
  it("stores the primary version under the pre-existing ats_master_resume key", async () => {
    await saveGuestResumeVersion(PRIMARY_RESUME_ID, resume("Main"));
    expect(store.get(GUEST_MASTER_KEY)).toEqual(resume("Main"));
  });

  it("keeps non-primary bodies under their own keys", async () => {
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");
    expect(await getGuestResumeVersion("ver_a")).toEqual(resume("Backend"));
    expect(store.get(GUEST_MASTER_KEY)).toBeUndefined();
  });

  it("does not clobber a chosen name when a later autosave omits one", async () => {
    await saveGuestResumeVersion("ver_a", resume("v1"), "Backend");
    await saveGuestResumeVersion("ver_a", resume("v2"));

    const versions = await listGuestResumeVersions();
    expect(versions.find((v) => v.id === "ver_a")?.name).toBe("Backend");
    expect(await getGuestResumeVersion("ver_a")).toEqual(resume("v2"));
  });
});

describe("renameGuestResumeVersion", () => {
  it("renames without touching the resume body", async () => {
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");
    await renameGuestResumeVersion("ver_a", "Platform");

    const versions = await listGuestResumeVersions();
    expect(versions.find((v) => v.id === "ver_a")?.name).toBe("Platform");
    expect(await getGuestResumeVersion("ver_a")).toEqual(resume("Backend"));
  });
});

describe("deleteGuestResumeVersion", () => {
  it("removes the body and its metadata", async () => {
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");
    await deleteGuestResumeVersion("ver_a");

    expect(await getGuestResumeVersion("ver_a")).toBeNull();
    expect((await listGuestResumeVersions()).some((v) => v.id === "ver_a")).toBe(false);
  });

  it("refuses to delete the primary version", async () => {
    await saveGuestResumeVersion(PRIMARY_RESUME_ID, resume("Main"));
    await deleteGuestResumeVersion(PRIMARY_RESUME_ID);
    expect(await getGuestResumeVersion(PRIMARY_RESUME_ID)).toEqual(resume("Main"));
  });
});

describe("collectGuestVersions", () => {
  it("returns non-primary versions with their bodies attached", async () => {
    await saveGuestResumeVersion(PRIMARY_RESUME_ID, resume("Main"));
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");

    const collected = await collectGuestVersions();
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({ id: "ver_a", name: "Backend", data: resume("Backend") });
  });

  it("skips metadata whose body has gone missing", async () => {
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");
    store.delete("ats_guest_resume_v_ver_a");
    expect(await collectGuestVersions()).toEqual([]);
  });
});

describe("clearGuestResumeData", () => {
  it("removes every resume key so the import is not re-offered next sign-in", async () => {
    await saveGuestResumeVersion(PRIMARY_RESUME_ID, resume("Main"));
    await saveGuestResumeVersion("ver_a", resume("Backend"), "Backend");

    await clearGuestResumeData();

    expect(store.has(GUEST_MASTER_KEY)).toBe(false);
    expect(store.has(GUEST_VERSIONS_KEY)).toBe(false);
    expect(store.has("ats_guest_resume_v_ver_a")).toBe(false);
  });
});
