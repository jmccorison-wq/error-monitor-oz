/**
 * Represents an error record from the DynamoDB audit log table
 */
export interface AuditLogError {
  /** Unique identifier for the error record */
  id: string;
  /** Timestamp when the error occurred */
  timestamp: string;
  /** Error message */
  message: string;
  /** Full stack trace */
  stackTrace: string;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Service or application that generated the error */
  source: string;
  /** Environment where the error occurred */
  environment: string;
  /** Commit SHA associated with the deployed code */
  commitSha?: string;
  /** Repository name */
  repository?: string;
  /** Whether this error has been processed */
  processed: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Filter options for querying audit log errors
 */
export interface AuditLogErrorFilter {
  /** Filter by processed status */
  processed?: boolean;
  /** Filter by severity levels */
  severity?: ErrorSeverity[];
  /** Filter by source */
  source?: string;
  /** Filter errors after this timestamp */
  since?: string;
  /** Maximum number of results */
  limit?: number;
}