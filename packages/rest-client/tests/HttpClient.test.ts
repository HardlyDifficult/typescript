import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { HttpClient } from "../src/HttpClient";
import { HttpError, NetworkError } from "../src/errors";

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
  },
}));

describe("HttpClient", () => {
  let client: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance.defaults = { headers: { common: {} } };
    client = new HttpClient({ retry: { maxAttempts: 2, delayMs: 10 } });
  });

  describe("successful requests", () => {
    it("GET returns response data", async () => {
      mockInstance.get.mockResolvedValue({ data: { id: 1 } });
      const result = await client.get("https://api.test/users/1");
      expect(result).toEqual({ id: 1 });
    });

    it("POST sends body and returns response data", async () => {
      mockInstance.post.mockResolvedValue({ data: { id: 2 } });
      const result = await client.post("https://api.test/users", {
        name: "Alice",
      });
      expect(result).toEqual({ id: 2 });
      expect(mockInstance.post).toHaveBeenCalledWith(
        "https://api.test/users",
        { name: "Alice" },
      );
    });

    it("DELETE returns response data", async () => {
      mockInstance.delete.mockResolvedValue({ data: { ok: true } });
      const result = await client.delete("https://api.test/users/1");
      expect(result).toEqual({ ok: true });
    });

    it("PATCH sends body", async () => {
      mockInstance.patch.mockResolvedValue({ data: { updated: true } });
      const result = await client.patch("https://api.test/users/1", {
        name: "Bob",
      });
      expect(result).toEqual({ updated: true });
    });

    it("PUT sends body", async () => {
      mockInstance.put.mockResolvedValue({ data: { replaced: true } });
      const result = await client.put("https://api.test/users/1", {
        name: "Carol",
      });
      expect(result).toEqual({ replaced: true });
    });
  });

  describe("bearer token", () => {
    it("sets Authorization header", () => {
      client.setBearerToken("tok123");
      expect(mockInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer tok123",
      );
    });

    it("clears Authorization header", () => {
      client.setBearerToken("tok123");
      client.clearBearerToken();
      expect(
        mockInstance.defaults.headers.common["Authorization"],
      ).toBeUndefined();
    });
  });

  describe("retry logic", () => {
    it("retries on 500 errors", async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get
        .mockRejectedValueOnce(axiosError)
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({ data: { ok: true } });

      const result = await client.get("https://api.test/health");
      expect(result).toEqual({ ok: true });
      expect(mockInstance.get).toHaveBeenCalledTimes(3);
    });

    it("does not retry on 400 errors by default", async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 400, statusText: "Bad Request", data: {} },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get.mockRejectedValue(axiosError);

      await expect(client.get("https://api.test/bad")).rejects.toThrow(
        HttpError,
      );
      expect(mockInstance.get).toHaveBeenCalledOnce();
    });

    it("retries on network errors (no response)", async () => {
      const networkError = {
        isAxiosError: true,
        response: undefined,
        message: "ECONNREFUSED",
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: "ok" });

      const result = await client.get("https://api.test/retry");
      expect(result).toBe("ok");
      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });

    it("retries on custom retryable statuses", async () => {
      const customClient = new HttpClient({
        retry: { maxAttempts: 1, delayMs: 1, retryableStatuses: [429] },
      });
      const error429 = {
        isAxiosError: true,
        response: { status: 429, data: {} },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ data: "ok" });

      const result = await customClient.get("https://api.test/rate-limited");
      expect(result).toBe("ok");
    });

    it("retries when custom isRetryable returns true", async () => {
      const customClient = new HttpClient({
        retry: {
          maxAttempts: 1,
          delayMs: 1,
          isRetryable: (status, body) =>
            status === 409 && body["code"] === "CONFLICT",
        },
      });
      const conflictError = {
        isAxiosError: true,
        response: { status: 409, data: { code: "CONFLICT" } },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.post
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValueOnce({ data: "ok" });

      const result = await customClient.post("https://api.test/conflict");
      expect(result).toBe("ok");
    });

    it("stops retrying after maxAttempts", async () => {
      const serverError = {
        isAxiosError: true,
        response: { status: 503, statusText: "Unavailable", data: {} },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get.mockRejectedValue(serverError);

      await expect(client.get("https://api.test/down")).rejects.toThrow(
        HttpError,
      );
      // 1 initial + 2 retries = 3 total
      expect(mockInstance.get).toHaveBeenCalledTimes(3);
    });
  });

  describe("error formatting", () => {
    it("includes code and message from response body", async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: "Bad Request",
          data: { code: "INVALID_INPUT", message: "name is required" },
        },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get.mockRejectedValue(error);

      try {
        await client.get("https://api.test/bad");
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        const httpErr = e as HttpError;
        expect(httpErr.message).toContain("INVALID_INPUT");
        expect(httpErr.message).toContain("name is required");
        expect(httpErr.status).toBe(400);
      }
    });

    it("truncates long cause strings", async () => {
      const longCause = "x".repeat(300);
      const error = {
        isAxiosError: true,
        response: { status: 500, data: { cause: longCause } },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const noRetryClient = new HttpClient({
        retry: { maxAttempts: 0, delayMs: 1 },
      });
      mockInstance.get.mockRejectedValue(error);

      try {
        await noRetryClient.get("https://api.test/err");
        expect.fail("should have thrown");
      } catch (e) {
        const httpErr = e as HttpError;
        expect(httpErr.message).toContain("...");
        expect(httpErr.message.length).toBeLessThan(400);
      }
    });

    it("wraps non-axios errors as NetworkError", async () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      mockInstance.get.mockRejectedValue(new Error("socket hang up"));

      await expect(client.get("https://api.test/fail")).rejects.toThrow(
        NetworkError,
      );
    });
  });

  describe("logging", () => {
    it("calls logger.debug on success", async () => {
      const logger = { debug: vi.fn() };
      const loggingClient = new HttpClient({
        logger,
        retry: { maxAttempts: 0, delayMs: 1 },
      });
      mockInstance.get.mockResolvedValue({ data: "ok" });

      await loggingClient.get("https://api.test/log");
      expect(logger.debug).toHaveBeenCalledWith(
        "GET https://api.test/log",
        expect.any(Object),
      );
    });

    it("calls logger.warn on retry", async () => {
      const logger = { warn: vi.fn(), debug: vi.fn() };
      const loggingClient = new HttpClient({
        logger,
        retry: { maxAttempts: 1, delayMs: 1 },
      });
      const error500 = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      mockInstance.get
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({ data: "ok" });

      await loggingClient.get("https://api.test/retry-log");
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });
});
