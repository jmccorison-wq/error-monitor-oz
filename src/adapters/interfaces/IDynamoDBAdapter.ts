import type { AuditLogError, AuditLogErrorFilter } from '../../models/index.js';

/**
 * Interface for DynamoDB operations on the audit log table
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface IDynamoDBAdapter {
  /**
   * Fetches unprocessed errors from the audit log table
   * @param filter - Optional filter criteria
   * @returns Array of audit log errors
   */
  getUnprocessedErrors(filter?: AuditLogErrorFilter): Promise<AuditLogError[]>;

  /**
   * Gets a specific error by ID
   * @param id - Error ID
   * @returns The error record or null if not found
   */
  getErrorById(id: string): Promise<AuditLogError | null>;

  /**
   * Marks an error as processed
   * @param id - Error ID to mark as processed
   * @param metadata - Optional metadata to add to the record
   */
  markAsProcessed(id: string, metadata?: Record<string, unknown>): Promise<void>;

  /**
   * Updates an error record with fix information
   * @param id - Error ID
   * @param fixInfo - Information about the fix
   */
  updateErrorWithFixInfo(
    id: string,
    fixInfo: {
      workItemId?: number;
      pullRequestUrl?: string;
      branch?: string;
      fixedAt?: string;
    }
  ): Promise<void>;

  /**
   * Gets error statistics for monitoring
   */
  getErrorStats(): Promise<{
    totalUnprocessed: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  }>;
}
