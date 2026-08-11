import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase", () => ({
  db: {},
  auth: { currentUser: null },
}));

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const setDocMock = vi.fn();
const deleteDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: any[]) => ({ __type: "doc", segments: args.slice(1) }),
  collection: (...args: any[]) => ({ __type: "collection", segments: args.slice(1) }),
  getDoc: (...args: any[]) => getDocMock(...args),
  getDocs: (...args: any[]) => getDocsMock(...args),
  setDoc: (...args: any[]) => setDocMock(...args),
  deleteDoc: (...args: any[]) => deleteDocMock(...args),
  writeBatch: vi.fn(),
}));

const {
  saveResumeVersion,
  getResumeVersion,
  listResumeVersions,
  renameResumeVersion,
  deleteResumeVersion,
  saveMasterResume,
  getMasterResume,
  PRIMARY_RESUME_ID,
} = await import("./db");

beforeEach(() => {
  getDocMock.mockReset();
  getDocsMock.mockReset();
  setDocMock.mockReset();
  deleteDocMock.mockReset();
});

describe("saveResumeVersion", () => {
  it("writes name when provided", async () => {
    await saveResumeVersion("u1", "ver_abc", { contact: { name: "J" } } as any, "Backend");
    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "Backend", data: expect.anything() }),
      expect.anything()
    );
  });

  it("omits the name key entirely when not provided, so a merge doesn't clobber an existing custom name", async () => {
    await saveResumeVersion("u1", "ver_abc", { contact: { name: "J" } } as any);
    const payload = setDocMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty("name");
    expect(payload).toHaveProperty("data");
  });
});

describe("getResumeVersion", () => {
  it("returns the resume data when present", async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ data: { contact: { name: "Jane" } } }) });
    const result = await getResumeVersion("u1", "ver_abc");
    expect(result).toEqual({ contact: { name: "Jane" } });
  });

  it("returns null when the doc doesn't exist", async () => {
    getDocMock.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getResumeVersion("u1", "ver_missing");
    expect(result).toBeNull();
  });
});

describe("listResumeVersions", () => {
  it("maps docs to {id, name, updatedAt} and sorts primary first", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "ver_b", data: () => ({ name: "Data", updatedAt: 200 }) },
        { id: "primary", data: () => ({ name: "Master Resume", updatedAt: 100 }) },
        { id: "ver_a", data: () => ({ name: "Backend", updatedAt: 300 }) },
      ],
    });
    const result = await listResumeVersions("u1");
    expect(result[0].id).toBe(PRIMARY_RESUME_ID);
    expect(result.map((v) => v.id)).toEqual(["primary", "ver_a", "ver_b"]);
  });

  it("defaults a missing name to 'Untitled Resume'", async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: "ver_x", data: () => ({}) }] });
    const result = await listResumeVersions("u1");
    expect(result[0].name).toBe("Untitled Resume");
  });
});

describe("renameResumeVersion / deleteResumeVersion", () => {
  it("renameResumeVersion writes only name and updatedAt", async () => {
    await renameResumeVersion("u1", "ver_abc", "New Name");
    expect(setDocMock).toHaveBeenCalledWith(expect.anything(), { name: "New Name", updatedAt: expect.any(Number) }, expect.anything());
  });

  it("deleteResumeVersion calls deleteDoc", async () => {
    await deleteResumeVersion("u1", "ver_abc");
    expect(deleteDocMock).toHaveBeenCalledOnce();
  });
});

describe("legacy saveMasterResume/getMasterResume wrappers", () => {
  it("saveMasterResume targets the primary resume id without setting a name", async () => {
    await saveMasterResume("u1", { contact: { name: "J" } } as any);
    const [, payload] = setDocMock.mock.calls[0];
    expect(payload).not.toHaveProperty("name");
  });

  it("getMasterResume reads from the primary resume id", async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ data: { contact: { name: "Jane" } } }) });
    const result = await getMasterResume("u1");
    expect(result).toEqual({ contact: { name: "Jane" } });
  });
});
