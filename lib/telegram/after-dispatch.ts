import { after } from "next/server";

/**
 * Schedules `task` to run after the response has been sent, using Next.js 15's
 * after() API. Unlike a bare `void asyncFn()`, after() is registered with the
 * request's lifecycle by the runtime, so the platform keeps the function
 * instance alive until the callback settles.
 *
 * Errors inside `task` are caught and logged.
 */
export function dispatchAfterResponse(task: () => Promise<unknown>, label: string) {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[telegram:after] dispatch failed (${label})`, err);
    }
  });
}
