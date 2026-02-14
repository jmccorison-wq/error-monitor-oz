/**
 * Result of a bug fix attempt
 */
export interface FixResult {
  /** Whether the fix was successful */
  success: boolean;
  /** Error ID that was fixed */
  errorId: string;
  /** Repository that was fixed */
  repository: string;
  /** Branch where fix was applied */
  branch: string;
  /** Files modified */
  modifiedFiles: ModifiedFile[];
  /** Pull request URL */
  pullRequestUrl?: string;
  /** Pull request number */
  pullRequestNumber?: number;
  /** DevOps work item ID */
  workItemId?: number;
  /** Summary of the fix */
  fixSummary: string;
  /** Oz agent run ID */
  ozRunId?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp of the fix */
  timestamp: string;
}

/**
 * Information about a modified file
 */
export interface ModifiedFile {
  /** File path */
  path: string;
  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted';
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
}

/**
 * Stages of the fix workflow
 */
export type FixWorkflowStage =
  | 'initializing'
  | 'parsing_error'
  | 'finding_repository'
  | 'creating_work_item'
  | 'creating_branch'
  | 'running_oz_agent'
  | 'creating_pull_request'
  | 'notifying_team'
  | 'completed'
  | 'failed';

/**
 * Status of the fix workflow
 */
export interface FixWorkflowStatus {
  /** Current stage */
  stage: FixWorkflowStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime?: string;
  /** Error if failed */
  error?: string;
}
