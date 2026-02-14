import type { StackTrace } from '../../models/index.js';

/**
 * Interface for Warp Oz agent operations
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface IOzAdapter {
  /**
   * Runs the Oz agent to fix a bug
   * @param params - Parameters for the bug fix
   * @returns Result of the fix attempt
   */
  fixBug(params: {
    /** Error message */
    errorMessage: string;
    /** Parsed stack trace */
    stackTrace: StackTrace;
    /** Repository to work on */
    repository: string;
    /** Branch to work on */
    branch: string;
    /** Additional context for the fix */
    context?: string;
    /** Environment ID for the agent */
    environmentId?: string;
    /** MCP server configurations */
    mcpServers?: Record<string, OzMcpServerConfig>;
  }): Promise<OzFixResult>;

  /**
   * Gets the status of a running agent task
   * @param runId - Run ID from a previous run
   */
  getRunStatus(runId: string): Promise<OzRunStatus>;

  /**
   * Waits for a run to complete
   * @param runId - Run ID
   * @param timeoutMs - Maximum time to wait
   */
  waitForCompletion(runId: string, timeoutMs?: number): Promise<OzFixResult>;

  /**
   * Cancels a running agent task
   * @param runId - Run ID to cancel
   */
  cancelRun(runId: string): Promise<void>;
}

/**
 * MCP server configuration for Oz agent
 */
export interface OzMcpServerConfig {
  /** Warp shared MCP server ID */
  warp_id?: string;
  /** Command to run for custom server */
  command?: string;
  /** Arguments for custom server */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL for remote server */
  url?: string;
  /** Headers for remote server */
  headers?: Record<string, string>;
}

/**
 * Result from an Oz agent fix attempt
 */
export interface OzFixResult {
  /** Run ID */
  runId: string;
  /** Whether the fix was successful */
  success: boolean;
  /** Summary of changes made */
  summary: string;
  /** Files modified */
  filesModified: string[];
  /** Commit SHA if changes were committed */
  commitSha?: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Status of an Oz agent run
 */
export interface OzRunStatus {
  /** Run ID */
  runId: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Progress message */
  message?: string;
  /** Start time */
  startedAt: string;
  /** Completion time */
  completedAt?: string;
}
