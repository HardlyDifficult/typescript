import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createRestClient,
  defineOperation,
  operation,
  RestClient,
} from "../src";
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

const GetUser = operation.get<User>({
  params: z.object({ id: z.string() }),
  path: ({ id }) => `/users/${id}`,
});

const CreateUser = operation.post<User>({
  params: z.object({ name: z.string().min(1) }),
  path: "/users",
  body: ({ name }) => ({ name }),
});

const GetUsers = operation.get<User[]>({
  path: "/users",
  parse: (users: User[]) => users.filter((user) => user.name !== ""),
});

const SearchUserNames = operation.get<
  string[],
  { q: string },
  { items: Array<{ name: string }> }
>({
  params: z.object({ q: z.string().min(1) }),
  path: ({ q }) => `/users/search?q=${encodeURIComponent(q)}`,
  parse: (response) => response.items.map((user) => user.name),
});

const GetLegacyUser = defineOperation<{ id: string }, User>({
  params: z.object({ id: z.string() }),
  method: "GET",
  url: ({ id }) => `/legacy-users/${id}`,
});

class TestApi extends RestClient {
  getUser = this.bind(GetUser);
}

describe("RestClient", () => {
  let api: ReturnType<typeof createApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance.defaults = { headers: { common: {} } };
    api = createApi();
  });

  describe("constructor", () => {
    it("throws ConfigurationError without baseUrl", () => {
      expect(() => new RestClient({ baseUrl: "" })).toThrow(ConfigurationError);
    });

    it("exposes baseUrl", () => {
      expect(api.getBaseUrl()).toBe("https://api.test/v1");
    });
  });

  describe("bound operations", () => {
    it("builds URLs from relative paths", async () => {
      mockInstance.get.mockResolvedValue({ data: { id: "1", name: "Alice" } });

      const user = await api.getUser({ id: "1" });
      expect(user).toEqual({ id: "1", name: "Alice" });
      expect(mockInstance.get).toHaveBeenCalledWith(
        "https://api.test/v1/users/1"
      );
    });

    it("sends request bodies from params", async () => {
      mockInstance.post.mockResolvedValue({
        data: { id: "2", name: "Bob" },
      });

      const user = await api.createUser({ name: "Bob" });
      expect(user).toEqual({ id: "2", name: "Bob" });
      expect(mockInstance.post).toHaveBeenCalledWith(
        "https://api.test/v1/users",
        {
          name: "Bob",
        }
      );
    });

    it("validates params before request", async () => {
      await expect(api.createUser({ name: "" })).rejects.toThrow(
        ValidationError
      );
      expect(mockInstance.post).not.toHaveBeenCalled();
    });

    it("calls no-arg operations without undefined boilerplate", async () => {
      mockInstance.get.mockResolvedValue({
        data: [
          { id: "1", name: "Alice" },
          { id: "2", name: "" },
          { id: "3", name: "Carol" },
        ],
      });

      const users = await api.getUsers();
      expect(users).toEqual([
        { id: "1", name: "Alice" },
        { id: "3", name: "Carol" },
      ]);
    });

    it("parses raw responses into a cleaner client-facing shape", async () => {
      mockInstance.get.mockResolvedValue({
        data: { items: [{ name: "Alice" }, { name: "Bob" }] },
      });

      const names = await api.searchUserNames({ q: "a" });
      expect(names).toEqual(["Alice", "Bob"]);
    });

    it("still supports subclass-based clients", async () => {
      const legacyApi = new TestApi({
        baseUrl: "https://api.test/v1",
        retry: { maxAttempts: 0, delayMs: 1 },
      });

      mockInstance.get.mockResolvedValue({ data: { id: "1", name: "Alice" } });

      const user = await legacyApi.getUser({ id: "1" });
      expect(user).toEqual({ id: "1", name: "Alice" });
    });

    it("resolves relative URLs from the legacy url callback", async () => {
      const legacyApi = createRestClient(
        {
          baseUrl: "https://api.test/v1",
          retry: { maxAttempts: 0, delayMs: 1 },
        },
        {
          getLegacyUser: GetLegacyUser,
        }
      );

      mockInstance.get.mockResolvedValue({ data: { id: "1", name: "Alice" } });

      await legacyApi.getLegacyUser({ id: "1" });
      expect(mockInstance.get).toHaveBeenCalledWith(
        "https://api.test/v1/legacy-users/1"
      );
    });
  });

  describe("auth integration", () => {
    it("authenticates with no-auth by default", async () => {
      mockInstance.get.mockResolvedValue({ data: {} });
      await api.get("/ping");
      expect(
        mockInstance.defaults.headers.common["Authorization"]
      ).toBeUndefined();
    });

    it("sets bearer token with static auth", async () => {
      const authedApi = createApi({
        auth: { type: "bearer", token: "my-token" },
      });

      mockInstance.get.mockResolvedValue({ data: {} });
      await authedApi.get("/secure");
      expect(mockInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer my-token"
      );
    });

    it("clearToken resets auth state", async () => {
      const authedApi = createApi({
        auth: { type: "bearer", token: "my-token" },
      });

      mockInstance.get.mockResolvedValue({ data: {} });
      await authedApi.get("/secure");
      authedApi.clearToken();
      expect(
        mockInstance.defaults.headers.common["Authorization"]
      ).toBeUndefined();
    });
  });

  describe("direct HTTP methods", () => {
    it("resolves relative GET paths against baseUrl", async () => {
      mockInstance.get.mockResolvedValue({ data: "ok" });
      expect(await api.get("/raw")).toBe("ok");
      expect(mockInstance.get).toHaveBeenCalledWith("https://api.test/v1/raw");
    });

    it("post", async () => {
      mockInstance.post.mockResolvedValue({ data: "created" });
      expect(await api.post("/raw", { x: 1 })).toBe("created");
      expect(mockInstance.post).toHaveBeenCalledWith(
        "https://api.test/v1/raw",
        {
          x: 1,
        }
      );
    });

    it("delete", async () => {
      mockInstance.delete.mockResolvedValue({ data: "deleted" });
      expect(await api.delete("/raw/1")).toBe("deleted");
      expect(mockInstance.delete).toHaveBeenCalledWith(
        "https://api.test/v1/raw/1"
      );
    });

    it("patch", async () => {
      mockInstance.patch.mockResolvedValue({ data: "patched" });
      expect(await api.patch("/raw/1", { x: 2 })).toBe("patched");
      expect(mockInstance.patch).toHaveBeenCalledWith(
        "https://api.test/v1/raw/1",
        { x: 2 }
      );
    });

    it("put", async () => {
      mockInstance.put.mockResolvedValue({ data: "replaced" });
      expect(await api.put("/raw/1", { x: 3 })).toBe("replaced");
      expect(mockInstance.put).toHaveBeenCalledWith(
        "https://api.test/v1/raw/1",
        {
          x: 3,
        }
      );
    });
  });

  describe("factory behavior", () => {
    it("rejects operation names that collide with RestClient methods", () => {
      expect(() =>
        createRestClient(
          {
            baseUrl: "https://api.test/v1",
            retry: { maxAttempts: 0, delayMs: 1 },
          },
          { get: GetUser }
        )
      ).toThrow(ConfigurationError);
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

function createApi(
  overrides: Partial<ConstructorParameters<typeof RestClient>[0]> = {}
) {
  return createRestClient(
    {
      baseUrl: "https://api.test/v1",
      retry: { maxAttempts: 0, delayMs: 1 },
      ...overrides,
    },
    {
      getUser: GetUser,
      createUser: CreateUser,
      getUsers: GetUsers,
      searchUserNames: SearchUserNames,
    }
  );
}
