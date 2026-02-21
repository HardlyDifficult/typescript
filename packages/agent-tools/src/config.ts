/** Max bytes to return from read_file before truncating. */
export const MAX_READ_BYTES = 100_000;

/** Max file size (bytes) to scan during content search — skip larger files. */
export const MAX_GREP_FILE_SIZE = 100 * 1024;

/** Max total matches returned by search_files. */
export const MAX_SEARCH_RESULTS = 100;

/** Lines of context to show around each edit in write_file output. */
export const MAX_CONTEXT_LINES = 3;

/** Timeout for verify tool commands (ms). */
export const VERIFY_TIMEOUT = 120_000;
