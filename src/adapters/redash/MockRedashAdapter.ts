import type { IRedashAdapter, RedashQueryResult } from '../interfaces/index.js';

/**
 * Mock Redash adapter for testing and development
 */
export class MockRedashAdapter implements IRedashAdapter {
  private queries: Map<
    number,
    { id: number; name: string; query: string; dataSourceId: number }
  > = new Map();
  private queryResults: Map<number, RedashQueryResult> = new Map();
  private queryIdCounter = 100;

  constructor() {
    // Seed with sample data
    this.seedSampleData();
  }

  private seedSampleData(): void {
    // Add a sample error monitoring query
    this.queries.set(1, {
      id: 1,
      name: 'Unprocessed Errors',
      query: 'SELECT * FROM audit_log WHERE processed = false',
      dataSourceId: 1,
    });

    // Add sample results
    this.queryResults.set(1, {
      columns: [
        { name: 'id', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'severity', type: 'string' },
        { name: 'timestamp', type: 'datetime' },
      ],
      rows: [
        {
          id: 'err-001',
          message: 'Connection timeout',
          severity: 'error',
          timestamp: new Date().toISOString(),
        },
      ],
      metadata: {
        dataSourceId: 1,
        queryId: 1,
        retrievedAt: new Date().toISOString(),
        runTime: 0.5,
      },
    });
  }

  async executeQuery<T = Record<string, unknown>>(
    queryId: number,
    _parameters?: Record<string, unknown>
  ): Promise<RedashQueryResult<T>> {
    const result = this.queryResults.get(queryId);
    if (!result) {
      throw new Error(`Query ${queryId} not found`);
    }

    return {
      ...result,
      rows: result.rows as T[],
      metadata: {
        ...result.metadata,
        retrievedAt: new Date().toISOString(),
      },
    };
  }

  async createQuery(params: {
    name: string;
    query: string;
    dataSourceId: number;
    description?: string;
    tags?: string[];
  }): Promise<number> {
    const id = this.queryIdCounter++;
    this.queries.set(id, {
      id,
      name: params.name,
      query: params.query,
      dataSourceId: params.dataSourceId,
    });
    return id;
  }

  async getDataSources(): Promise<Array<{ id: number; name: string; type: string }>> {
    return [
      { id: 1, name: 'Production DynamoDB', type: 'dynamodb' },
      { id: 2, name: 'Analytics PostgreSQL', type: 'pg' },
    ];
  }

  async getQuery(
    queryId: number
  ): Promise<{ id: number; name: string; query: string; dataSourceId: number } | null> {
    return this.queries.get(queryId) ?? null;
  }

  async refreshQuery(_queryId: number): Promise<void> {
    // Mock implementation - just update the retrieved timestamp
  }

  // Helper methods for testing
  setQueryResult<T>(queryId: number, result: RedashQueryResult<T>): void {
    this.queryResults.set(queryId, result as RedashQueryResult);
  }

  clear(): void {
    this.queries.clear();
    this.queryResults.clear();
    this.queryIdCounter = 100;
  }
}
