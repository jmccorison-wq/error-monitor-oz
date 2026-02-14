import type { IDynamoDBAdapter } from '../interfaces/index.js';
import type { AuditLogError, AuditLogErrorFilter } from '../../models/index.js';

/**
 * Mock DynamoDB adapter for testing and development
 */
export class MockDynamoDBAdapter implements IDynamoDBAdapter {
  private errors: Map<string, AuditLogError> = new Map();

  constructor(initialErrors?: AuditLogError[]) {
    if (initialErrors) {
      for (const error of initialErrors) {
        this.errors.set(error.id, error);
      }
    } else {
      // Add some sample errors for testing
      this.seedSampleData();
    }
  }

  private seedSampleData(): void {
    const sampleErrors: AuditLogError[] = [
      {
        id: 'err-001',
        timestamp: new Date().toISOString(),
        message: "TypeError: Cannot read property 'map' of undefined",
        stackTrace: `TypeError: Cannot read property 'map' of undefined
    at UserService.getUsers (/src/services/UserService.ts:45:23)
    at async UserController.list (/src/controllers/UserController.ts:12:18)
    at async /src/routes/users.ts:8:5`,
        severity: 'error',
        source: 'user-service',
        environment: 'production',
        commitSha: 'abc123def',
        repository: 'myorg/user-service',
        processed: false,
      },
      {
        id: 'err-002',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        message: 'Database connection timeout',
        stackTrace: `Error: Database connection timeout
    at PostgresPool.connect (/src/db/connection.ts:78:11)
    at async DataRepository.query (/src/repositories/DataRepository.ts:23:5)
    at async ReportService.generate (/src/services/ReportService.ts:156:12)`,
        severity: 'critical',
        source: 'report-service',
        environment: 'production',
        commitSha: 'def456ghi',
        repository: 'myorg/report-service',
        processed: false,
      },
    ];

    for (const error of sampleErrors) {
      this.errors.set(error.id, error);
    }
  }

  async getUnprocessedErrors(filter?: AuditLogErrorFilter): Promise<AuditLogError[]> {
    let results = Array.from(this.errors.values()).filter((e) => !e.processed);

    if (filter?.severity && filter.severity.length > 0) {
      results = results.filter((e) => filter.severity!.includes(e.severity));
    }

    if (filter?.source) {
      results = results.filter((e) => e.source === filter.source);
    }

    if (filter?.since) {
      results = results.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async getErrorById(id: string): Promise<AuditLogError | null> {
    return this.errors.get(id) ?? null;
  }

  async markAsProcessed(id: string, metadata?: Record<string, unknown>): Promise<void> {
    const error = this.errors.get(id);
    if (error) {
      error.processed = true;
      if (metadata) {
        error.metadata = { ...error.metadata, ...metadata };
      }
    }
  }

  async updateErrorWithFixInfo(
    id: string,
    fixInfo: {
      workItemId?: number;
      pullRequestUrl?: string;
      branch?: string;
      fixedAt?: string;
    }
  ): Promise<void> {
    const error = this.errors.get(id);
    if (error) {
      error.metadata = {
        ...error.metadata,
        ...fixInfo,
      };
    }
  }

  async getErrorStats(): Promise<{
    totalUnprocessed: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const unprocessed = Array.from(this.errors.values()).filter((e) => !e.processed);
    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const error of unprocessed) {
      bySeverity[error.severity] = (bySeverity[error.severity] ?? 0) + 1;
      bySource[error.source] = (bySource[error.source] ?? 0) + 1;
    }

    return {
      totalUnprocessed: unprocessed.length,
      bySeverity,
      bySource,
    };
  }

  // Helper methods for testing
  addError(error: AuditLogError): void {
    this.errors.set(error.id, error);
  }

  clear(): void {
    this.errors.clear();
  }
}
