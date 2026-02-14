/**
 * Interface for Redash operations
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface IRedashAdapter {
  /**
   * Executes a saved query by ID
   * @param queryId - Redash query ID
   * @param parameters - Optional query parameters
   * @returns Query results
   */
  executeQuery<T = Record<string, unknown>>(
    queryId: number,
    parameters?: Record<string, unknown>
  ): Promise<RedashQueryResult<T>>;

  /**
   * Creates a new query
   * @param params - Query creation parameters
   * @returns Created query ID
   */
  createQuery(params: {
    name: string;
    query: string;
    dataSourceId: number;
    description?: string;
    tags?: string[];
  }): Promise<number>;

  /**
   * Gets available data sources
   */
  getDataSources(): Promise<
    Array<{
      id: number;
      name: string;
      type: string;
    }>
  >;

  /**
   * Gets query by ID
   * @param queryId - Query ID
   */
  getQuery(queryId: number): Promise<{
    id: number;
    name: string;
    query: string;
    dataSourceId: number;
  } | null>;

  /**
   * Refreshes a query (triggers new execution)
   * @param queryId - Query ID
   */
  refreshQuery(queryId: number): Promise<void>;
}

/**
 * Result from a Redash query execution
 */
export interface RedashQueryResult<T = Record<string, unknown>> {
  /** Column definitions */
  columns: Array<{
    name: string;
    type: string;
  }>;
  /** Result rows */
  rows: T[];
  /** Metadata about the query execution */
  metadata: {
    dataSourceId: number;
    queryId: number;
    retrievedAt: string;
    runTime: number;
  };
}
