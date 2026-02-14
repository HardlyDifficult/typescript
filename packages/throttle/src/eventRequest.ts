/**
 * A function that subscribes a handler to an event source and returns
 * an unsubscribe function. This is the standard subscription pattern
 * used throughout the codebase (onReply, onMessage, onReaction, etc.).
 */
export type EventSubscriber<T> = (handler: (event: T) => void) => () => void;

/**
 * Options for {@link eventRequest}.
 */
export interface EventRequestOptions<TComplete, TError, TData> {
  /** Called after all subscriptions are set up. Sends the request. */
  send: () => void;
  /** Predicate applied to every event — only matching events are processed. */
  match: (event: TComplete | TError | TData) => boolean;
  /** Event subscribers. */
  on: {
    /** Resolves the returned promise with the event value. */
    complete: EventSubscriber<TComplete>;
    /** Rejects the returned promise with the event value. */
    error: EventSubscriber<TError>;
    /** Optional streaming data events. */
    data?: EventSubscriber<TData>;
  };
  /** Called for each matching data event. Only used when on.data is provided. */
  onData?: (event: TData) => void;
}

/**
 * Send a request and await a response via event subscriptions.
 *
 * Converts the subscribe → filter → resolve/reject pattern into a
 * single promise. Subscriptions are established before `send()` is
 * called to prevent race conditions, and all subscriptions are
 * automatically cleaned up when the first matching complete or error
 * event arrives.
 *
 * @example
 * ```typescript
 * const result = await eventRequest({
 *   send: () => manager.send(workerId, { requestId, prompt }),
 *   match: (event) => event.requestId === requestId,
 *   on: {
 *     complete: (cb) => manager.onComplete(cb),
 *     error: (cb) => manager.onError(cb),
 *     data: (cb) => manager.onOutput(cb),
 *   },
 *   onData: (output) => stream.append(output.content),
 * });
 * ```
 */
export function eventRequest<TComplete, TError = unknown, TData = unknown>(
  options: EventRequestOptions<TComplete, TError, TData>
): Promise<TComplete> {
  const { send, match, on, onData } = options;

  return new Promise<TComplete>((resolve, reject) => {
    const unsubscribers: (() => void)[] = [];

    const cleanup = (): void => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };

    unsubscribers.push(
      on.complete((event) => {
        if (!match(event)) {
          return;
        }
        cleanup();
        resolve(event);
      })
    );

    unsubscribers.push(
      on.error((event) => {
        if (!match(event)) {
          return;
        }
        cleanup();
        // Error events are typed by the caller — forward as-is
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(event);
      })
    );

    if (on.data && onData) {
      unsubscribers.push(
        on.data((event) => {
          if (!match(event)) {
            return;
          }
          onData(event);
        })
      );
    }

    try {
      send();
    } catch (err) {
      cleanup();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(err);
    }
  });
}
