/** Generic shape every widget's data hook resolves to, so WidgetShell can
 * render loading/error/content states the same way for any widget. */
export type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "ready"; data: T; error: null };

export function asyncLoading<T>(): AsyncState<T> {
  return { status: "loading", data: null, error: null };
}

export function asyncError<T>(error: string): AsyncState<T> {
  return { status: "error", data: null, error };
}

export function asyncReady<T>(data: T): AsyncState<T> {
  return { status: "ready", data, error: null };
}
