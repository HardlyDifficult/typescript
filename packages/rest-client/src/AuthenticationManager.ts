import axios from "axios";

import { AuthenticationError, HttpError } from "./errors";
import type { AuthConfig, OAuth2Auth, RestClientLogger } from "./types";

interface TokenResponse {
  readonly access_token?: string;
  readonly token_type?: string;
  readonly expires_in?: number;
  readonly scope?: string;
}

/** Manages token lifecycle for all supported auth strategies. */
export class AuthenticationManager {
  private bearerToken: string | null = null;
  private tokenExpiry: number | null = null;
  private tokenIssuedAt: number | null = null;

  constructor(
    private readonly authConfig: AuthConfig,
    private readonly logger?: RestClientLogger
  ) {}

  async authenticate(): Promise<string> {
    if (this.isTokenValid() && this.bearerToken !== null) {
      return this.bearerToken;
    }

    switch (this.authConfig.type) {
      case "none":
        return "";

      case "bearer":
        this.bearerToken = this.authConfig.token;
        return this.bearerToken;

      case "generator": {
        this.bearerToken = await this.authConfig.generate();
        this.tokenIssuedAt = Date.now();
        this.tokenExpiry =
          this.tokenIssuedAt + (this.authConfig.cacheDurationMs ?? 60_000);
        return this.bearerToken;
      }

      case "oauth2":
        return this.authenticateOAuth2(this.authConfig);

      default:
        throw new AuthenticationError(
          `Unsupported auth type: ${(this.authConfig as { type: string }).type}`
        );
    }
  }

  clearToken(): void {
    this.bearerToken = null;
    this.tokenExpiry = null;
    this.tokenIssuedAt = null;
  }

  getTokenExpiryTime(): number | null {
    return this.tokenExpiry;
  }

  getTokenIssuedAt(): number | null {
    return this.tokenIssuedAt;
  }

  getTokenLifetimeMs(): number | null {
    if (this.tokenIssuedAt === null || this.tokenExpiry === null) {
      return null;
    }
    return this.tokenExpiry - this.tokenIssuedAt;
  }

  private async authenticateOAuth2(config: OAuth2Auth): Promise<string> {
    const grantType = config.grantType ?? "client_credentials";

    const formData = new URLSearchParams();
    formData.append("grant_type", grantType);
    formData.append("client_id", config.clientId);

    if (
      grantType === "client_credentials" &&
      config.clientSecret !== undefined &&
      config.clientSecret !== ""
    ) {
      formData.append("client_secret", config.clientSecret);
    }
    if (config.audience !== undefined && config.audience !== "") {
      formData.append("audience", config.audience);
    }
    if (config.scope !== undefined && config.scope !== "") {
      formData.append("scope", config.scope);
    }
    if (grantType === "password") {
      if (
        config.username === undefined ||
        config.username === "" ||
        config.password === undefined ||
        config.password === ""
      ) {
        throw new AuthenticationError(
          "Password grant requires username and password"
        );
      }
      formData.append("username", config.username);
      formData.append("password", config.password);
    }

    try {
      const response = await axios.post<TokenResponse>(
        config.tokenUrl,
        formData.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (
        response.data.access_token === undefined ||
        response.data.access_token === ""
      ) {
        throw new AuthenticationError(
          `Authentication response missing access_token from ${config.tokenUrl}`
        );
      }

      this.bearerToken = response.data.access_token;
      this.tokenIssuedAt = Date.now();

      if (
        response.data.expires_in !== undefined &&
        response.data.expires_in !== 0
      ) {
        this.tokenExpiry = this.tokenIssuedAt + response.data.expires_in * 1000;
      }

      this.logger?.debug?.("OAuth2 token acquired", {
        tokenUrl: config.tokenUrl,
        expiresIn: response.data.expires_in,
      });

      return this.bearerToken;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData =
          error.response?.data !== undefined
            ? JSON.stringify(error.response.data, null, 2)
            : error.message;

        throw new HttpError(
          `Authentication failed for ${config.tokenUrl}: ${String(status)} ${errorData}`,
          status,
          error.response?.statusText
        );
      }

      throw new AuthenticationError(
        `Authentication failed for ${config.tokenUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private isTokenValid(): boolean {
    if (this.bearerToken === null) {
      return false;
    }
    if (this.tokenExpiry === null) {
      return true;
    }
    const lifetimeMs = this.getTokenLifetimeMs();
    const defaultBufferMs = 5 * 60 * 1000;
    const bufferMs =
      lifetimeMs !== null
        ? Math.min(defaultBufferMs, Math.floor(lifetimeMs / 2))
        : defaultBufferMs;
    return Date.now() < this.tokenExpiry - bufferMs;
  }
}
