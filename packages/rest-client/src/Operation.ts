import { z } from "zod";

import { ConfigurationError, ValidationError } from "./errors.js";
import type { HttpMethod } from "./types.js";

/** Declarative configuration for a REST operation. */
export interface OperationConfig<
  Params = void,
  Response = unknown,
  RawResponse = Response,
> {
  readonly params?: z.ZodType<Params>;
  readonly method: HttpMethod;
  readonly path?: string | ((params: Params) => string);
  readonly url?: (params: Params, baseUrl: string) => string;
  readonly body?: (
    params: Params
  ) => Record<string, unknown> | string | undefined;
  readonly parse?: (response: RawResponse, params: Params) => Response;
  readonly transform?: (response: RawResponse, params: Params) => Response;
}

export type OperationOptions<
  Params = void,
  Response = unknown,
  RawResponse = Response,
> = Omit<OperationConfig<Params, Response, RawResponse>, "method">;

export type BoundOperation<Params, Response> = [Params] extends [void]
  ? () => Promise<Response>
  : (params: Params) => Promise<Response>;

/**
 * Define a REST operation declaratively.
 *
 * @example
 *   const GetUser = defineOperation<{ id: string }, User>({
 *     params: z.object({ id: z.string() }),
 *     method: "GET",
 *     url: (p, base) => `${base}/users/${p.id}`,
 *   });
 */
export function defineOperation<
  Params = void,
  Response = unknown,
  RawResponse = Response,
>(
  config: OperationConfig<Params, Response, RawResponse>
): OperationConfig<Params, Response, RawResponse> {
  if (config.path === undefined && config.url === undefined) {
    throw new ConfigurationError("Operation requires either path or url");
  }
  return config;
}

/** Validate params against a Zod schema, throwing ValidationError on failure. */
export function validateParams<T>(params: T, schema: z.ZodType<T>): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Parameter validation failed: ${error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
}

function defineMethodOperation<Response, Params = void, RawResponse = Response>(
  method: HttpMethod,
  config: OperationOptions<Params, Response, RawResponse>
): OperationConfig<Params, Response, RawResponse> {
  return defineOperation({ ...config, method });
}

export const operation = {
  get<Response, Params = void, RawResponse = Response>(
    config: OperationOptions<Params, Response, RawResponse>
  ): OperationConfig<Params, Response, RawResponse> {
    return defineMethodOperation("GET", config);
  },
  post<Response, Params = void, RawResponse = Response>(
    config: OperationOptions<Params, Response, RawResponse>
  ): OperationConfig<Params, Response, RawResponse> {
    return defineMethodOperation("POST", config);
  },
  delete<Response, Params = void, RawResponse = Response>(
    config: OperationOptions<Params, Response, RawResponse>
  ): OperationConfig<Params, Response, RawResponse> {
    return defineMethodOperation("DELETE", config);
  },
  patch<Response, Params = void, RawResponse = Response>(
    config: OperationOptions<Params, Response, RawResponse>
  ): OperationConfig<Params, Response, RawResponse> {
    return defineMethodOperation("PATCH", config);
  },
  put<Response, Params = void, RawResponse = Response>(
    config: OperationOptions<Params, Response, RawResponse>
  ): OperationConfig<Params, Response, RawResponse> {
    return defineMethodOperation("PUT", config);
  },
} as const;
