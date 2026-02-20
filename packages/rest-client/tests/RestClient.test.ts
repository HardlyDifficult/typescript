import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { RestClient } from "../src/RestClient";
import { defineOperation } from "../src/Operation";
import { ConfigurationError, ValidationError } from "../src/errors";

const { mockInstance } = vi.hoisted(() => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string | undefined> } },
  };
  return { mockInstance };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockInstance),
    isAxiosError: vi.fn(),
    post: vi.fn(),
  },
}));

interface User {
  id: string;
  name: string;
}

const GetUser = defineOperation<{ id: string }, User>({
  params: z.object({ id: z.string() }),
  method: "GET",
  url: (p, base) => `${base}/users/${p.id}`,
});

const CreateUser = defineOperation<{ name: string }, User>({
  params: z.object({ name: z.string().min(1) }),
  method: "POST",
  url: (_p, base) => `${base}/users`,
  body: (p) => ({ name: p.name }),
});

const GetUsers = defineOperation<void, User[]>({
  params: z.void(),
  method: "GET",
  url: (_p, base) => `${base}/users`,
  transform: (users) => users.filter((u) => u.name !== ""),
});

class TestApi extends RestClient {
  getUser = this.bind(GetUser);
  createUser = this.bind(CreateUser);
  getUsers = this.bind(GetUsers);
}

describe("RestClient", () => {
  let api: TestApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance.defaults = { headers: { common: {} } };

    api = new TestApi({
      baseUrl: "https://api.test",
      retry: { maxAttempts: 0, delayMs: 1 },
    });
  });

  describe("constructor", () => {
    it("throws ConfigurationError without baseUrl", () => {
      expect(() => new RestClient({ baseUrl: "" })).toThrow(
        ConfigurationError,
      );
    });

    it("exposes baseUrl", () => {
      expect(api.getBaseUrl()).toBe("https://api.test");
    });
  });

  describe("bound operations", () => {
    it("GET operation builds correct URL", async () => {
      mockInstance.get.mockResolvedValue({ data: { id: "1", name: "Alice" } });

      const user = await api.getUser({ id: "1" });
      expect(user).toEqual({ id: "1", name: "Alice" });
      expect(mockInstance.get).toHaveBeenCalledWith(
        "https://api.test/users/1",
      );
    });

    it("POST operation sends body", async () => {
      mockInstance.post.mockResolvedValue({
        data: { id: "2", name: "Bob" },
      });

      const user = await api.createUser({ name: "Bob" });
      expect(user).toEqual({ id: "2", name: "Bob" });
      expect(mockInstance.post).toHaveBeenCalledWith(
        "https://api.test/users",
        { name: "Bob" },
      );
    });

    it("validates params before request", async () => {
      await expect(api.createUser({ name: "" })).rejects.toThrow(
        ValidationError,
      );
      expect(mockInstance.post).not.toHaveBeenCalled();
    });

    it("applies transform to response", async () => {
      mockInstance.get.mockResolvedValue({
        data: [
          { id: "1", name: "Alice" },
          { id: "2", name: "" },
          { id: "3", name: "Carol" },
        ],
      });

      const users = await api.getUsers(undefined as void);
      expect(users).toEqual([
        { id: "1", name: "Alice" },
        { id: "3", name: "Carol" },
      ]);
    });
  });

  describe("auth integration", () => {
    it("authenticates with no-auth by default", async () => {
      mockInstance.get.mockResolvedValue({ data: {} });
      await api.get("https://api.test/ping");
      expect(
        mockInstance.defaults.headers.common["Authorization"],
      ).toBeUndefined();
    });

    it("sets bearer token with static auth", async () => {
      const authedApi = new TestApi({
        baseUrl: "https://api.test",
        auth: { type: "bearer", token: "my-token" },
        retry: { maxAttempts: 0, delayMs: 1 },
      });

      mockInstance.get.mockResolvedValue({ data: {} });
      await authedApi.get("https://api.test/secure");
      expect(mockInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer my-token",
      );
    });

    it("clearToken resets auth state", async () => {
      const authedApi = new TestApi({
        baseUrl: "https://api.test",
        auth: { type: "bearer", token: "my-token" },
        retry: { maxAttempts: 0, delayMs: 1 },
      });

      mockInstance.get.mockResolvedValue({ data: {} });
      await authedApi.get("https://api.test/secure");
      authedApi.clearToken();
      expect(
        mockInstance.defaults.headers.common["Authorization"],
      ).toBeUndefined();
    });
  });

  describe("direct HTTP methods", () => {
    it("get", async () => {
      mockInstance.get.mockResolvedValue({ data: "ok" });
      expect(await api.get("https://api.test/raw")).toBe("ok");
    });

    it("post", async () => {
      mockInstance.post.mockResolvedValue({ data: "created" });
      expect(await api.post("https://api.test/raw", { x: 1 })).toBe(
        "created",
      );
    });

    it("delete", async () => {
      mockInstance.delete.mockResolvedValue({ data: "deleted" });
      expect(await api.delete("https://api.test/raw/1")).toBe("deleted");
    });

    it("patch", async () => {
      mockInstance.patch.mockResolvedValue({ data: "patched" });
      expect(await api.patch("https://api.test/raw/1", { x: 2 })).toBe(
        "patched",
      );
    });

    it("put", async () => {
      mockInstance.put.mockResolvedValue({ data: "replaced" });
      expect(await api.put("https://api.test/raw/1", { x: 3 })).toBe(
        "replaced",
      );
    });
  });

  describe("token timing", () => {
    it("returns null when no auth configured", () => {
      expect(api.getTokenExpiryTime()).toBeNull();
      expect(api.getTokenIssuedAt()).toBeNull();
      expect(api.getTokenLifetimeMs()).toBeNull();
    });
  });
});
