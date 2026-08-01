export interface EntertainmentShortcut {
  id: string;
  name: string;
  /** Full path to the executable to launch. */
  path: string;
  /** Free-text extra arguments (e.g. a ROM/save path), split on whitespace
   * before being passed to the Rust command - good enough for "one more
   * path" style args without needing real shell-quoting support. */
  args: string;
}
