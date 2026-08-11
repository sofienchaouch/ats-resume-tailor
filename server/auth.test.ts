import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const verifyIdToken = vi.fn();
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken }),
}));

// initializeApp with just a projectId does no network I/O, so it's safe to
// let server/auth.ts run its real top-level init during tests.
const { attachUser, requireServerKey } = await import("./auth");

function mockReqRes(overrides: Partial<Request> = {}) {
  const req = { headers: {}, body: {}, ...overrides } as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

describe("requireServerKey", () => {
  it("blocks a request with no user and no BYO key", () => {
    const { req, res, next, status, json } = mockReqRes({ body: {} });
    requireServerKey(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTH_OR_KEY_REQUIRED" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks a request whose aiConfig.apiKey is only whitespace", () => {
    const { req, res, next, status } = mockReqRes({ body: { aiConfig: { apiKey: "   " } } });
    requireServerKey(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a request with a signed-in user and no key", () => {
    const { req, res, next, status } = mockReqRes({ user: { uid: "abc123" } as any, body: {} });
    requireServerKey(req, res, next);
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows a guest request that supplies its own API key", () => {
    const { req, res, next, status } = mockReqRes({ body: { aiConfig: { apiKey: "user-supplied-key" } } });
    requireServerKey(req, res, next);
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("attachUser", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it("calls next without setting req.user when no Authorization header is present", async () => {
    const { req, res, next } = mockReqRes({ headers: {} });
    await attachUser(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("calls next without setting req.user when the header isn't a Bearer token", async () => {
    const { req, res, next } = mockReqRes({ headers: { authorization: "Basic abc123" } });
    await attachUser(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets req.user when the bearer token verifies successfully", async () => {
    verifyIdToken.mockResolvedValue({ uid: "real-user-123" });
    const { req, res, next } = mockReqRes({ headers: { authorization: "Bearer valid.token.here" } });
    await attachUser(req, res, next);
    expect(req.user).toEqual({ uid: "real-user-123" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("never rejects: a forged/expired token still calls next with req.user unset", async () => {
    verifyIdToken.mockRejectedValue(new Error("Firebase ID token has invalid signature"));
    const { req, res, next } = mockReqRes({ headers: { authorization: "Bearer forged.token" } });
    await expect(attachUser(req, res, next)).resolves.toBeUndefined();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
