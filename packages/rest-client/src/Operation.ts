import { z } from "zod";
import { ValidationError } from "./errors";
import type { HttpMethod } from "./types";

/** Declarative configuration for a REST operation. */
export interface OperationConfig<Params, Response> {
  readonly params: z.ZodSchema<Params>;
  readonly method: HttpMethod;
  readonly url: (params: Params, baseUrl: string) => string;
  readonly body?: (params: Params) => Record<string, unknown> | string | undefined;
  readonly transform?: (response: Response) => Response;
}

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
export function defineOperation<Params, Response>(
  config: OperationConfig<Params, Response>,
): OperationConfig<Params, Response> {
  return config;
}

/** Validate params against a Zod schema, throwing ValidationError on failure. */
export function validateParams<T>(params: T, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Parameter validation failed: ${error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw error;
  }
}
