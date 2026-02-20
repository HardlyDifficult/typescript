import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { AuthenticationManager } from "../src/AuthenticationManager";
import { AuthenticationError, HttpError } from "../src/errors";

vi.mock("axios");

const mockedAxios = vi.mocked(axios, true);

describe("AuthenticationManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("no auth", () => {
    it("returns empty string", async () => {
      const mgr = new AuthenticationManager({ type: "none" });
      expect(await mgr.authenticate()).toBe("");
    });
  });

  describe("bearer token", () => {
    it("returns static token", async () => {
      const mgr = new AuthenticationManager({
        type: "bearer",
        token: "my-token",
      });
      expect(await mgr.authenticate()).toBe("my-token");
    });

    it("returns same token on subsequent calls", async () => {
      const mgr = new AuthenticationManager({
        type: "bearer",
        token: "my-token",
      });
      await mgr.authenticate();
      expect(await mgr.authenticate()).toBe("my-token");
    });
  });

  describe("token generator", () => {
    it("calls generate function", async () => {
      const generate = vi.fn().mockResolvedValue("generated-token");
      const mgr = new AuthenticationManager({ type: "generator", generate });

      expect(await mgr.authenticate()).toBe("generated-token");
      expect(generate).toHaveBeenCalledOnce();
    });

    it("caches token for cacheDurationMs", async () => {
      const generate = vi.fn().mockResolvedValue("tok");
      const mgr = new AuthenticationManager({
        type: "generator",
        generate,
        cacheDurationMs: 30_000,
      });

      await mgr.authenticate();
      await mgr.authenticate();
      expect(generate).toHaveBeenCalledOnce();
    });

    it("re-generates after cache expires", async () => {
      const generate = vi
        .fn()
        .mockResolvedValueOnce("tok1")
        .mockResolvedValueOnce("tok2");
      const mgr = new AuthenticationManager({
        type: "generator",
        generate,
        cacheDurationMs: 10_000,
      });

      await mgr.authenticate();

      // Advance past cache + 5 min buffer
      vi.advanceTimersByTime(10_000 + 5 * 60 * 1000);

      expect(await mgr.authenticate()).toBe("tok2");
      expect(generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("OAuth2", () => {
    it("exchanges client credentials for token", async () => {
      mockedAxios.post.mockResolvedValue({
        data: { access_token: "oauth-token", expires_in: 3600 },
      });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "client-id",
        clientSecret: "client-secret",
      });

      const token = await mgr.authenticate();
      expect(token).toBe("oauth-token");
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://auth.example.com/token",
        expect.stringContaining("grant_type=client_credentials"),
        expect.objectContaining({
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
    });

    it("caches token until near expiry", async () => {
      mockedAxios.post.mockResolvedValue({
        data: { access_token: "tok", expires_in: 3600 },
      });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
      });

      await mgr.authenticate();
      await mgr.authenticate();
      expect(mockedAxios.post).toHaveBeenCalledOnce();
    });

    it("refreshes token when near expiry", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { access_token: "tok1", expires_in: 600 },
        })
        .mockResolvedValueOnce({
          data: { access_token: "tok2", expires_in: 600 },
        });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
      });

      await mgr.authenticate();
      // Advance past 5 min buffer
      vi.advanceTimersByTime(600 * 1000);

      expect(await mgr.authenticate()).toBe("tok2");
    });

    it("sends audience and scope when configured", async () => {
      mockedAxios.post.mockResolvedValue({
        data: { access_token: "tok" },
      });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
        audience: "https://api.example.com",
        scope: "read write",
      });

      await mgr.authenticate();

      const body = mockedAxios.post.mock.calls[0][1] as string;
      expect(body).toContain("audience=https");
      expect(body).toContain("scope=read+write");
    });

    it("throws AuthenticationError for password grant without username", async () => {
      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
        grantType: "password",
      });

      await expect(mgr.authenticate()).rejects.toThrow(AuthenticationError);
    });

    it("throws HttpError on HTTP failure", async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: { status: 401, statusText: "Unauthorized", data: {} },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
        clientSecret: "secret",
      });

      await expect(mgr.authenticate()).rejects.toThrow(HttpError);
    });

    it("throws AuthenticationError when access_token missing", async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
      });

      await expect(mgr.authenticate()).rejects.toThrow(AuthenticationError);
    });
  });

  describe("clearToken", () => {
    it("forces re-authentication", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({ data: { access_token: "tok1" } })
        .mockResolvedValueOnce({ data: { access_token: "tok2" } });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
      });

      await mgr.authenticate();
      mgr.clearToken();
      expect(await mgr.authenticate()).toBe("tok2");
    });
  });

  describe("token timing", () => {
    it("returns null when no token acquired", () => {
      const mgr = new AuthenticationManager({ type: "none" });
      expect(mgr.getTokenExpiryTime()).toBeNull();
      expect(mgr.getTokenIssuedAt()).toBeNull();
      expect(mgr.getTokenLifetimeMs()).toBeNull();
    });

    it("tracks timing after OAuth2 auth", async () => {
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

      mockedAxios.post.mockResolvedValue({
        data: { access_token: "tok", expires_in: 3600 },
      });

      const mgr = new AuthenticationManager({
        type: "oauth2",
        tokenUrl: "https://auth.example.com/token",
        clientId: "cid",
      });

      await mgr.authenticate();

      expect(mgr.getTokenIssuedAt()).toBe(
        new Date("2025-01-01T00:00:00Z").getTime()
      );
      expect(mgr.getTokenExpiryTime()).toBe(
        new Date("2025-01-01T00:00:00Z").getTime() + 3600 * 1000
      );
      expect(mgr.getTokenLifetimeMs()).toBe(3600 * 1000);
    });
  });
});
