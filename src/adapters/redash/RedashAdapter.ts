import axios, { type AxiosInstance } from 'axios';
import type { IRedashAdapter, RedashQueryResult } from '../interfaces/index.js';

/**
 * Redash adapter implementation
 */
export class RedashAdapter implements IRedashAdapter {
  private readonly client: AxiosInstance;

  constructor(config: { baseUrl: string; apiKey: string }) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Key ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async executeQuery<T = Record<string, unknown>>(
    queryId: number,
    parameters?: Record<string, unknown>
  ): Promise<RedashQueryResult<T>> {
    // Trigger a new query execution
    const executeResponse = await this.client.post(`/api/queries/${queryId}/results`, {
      parameters: parameters ?? {},
    });

    const jobId = executeResponse.data.job?.id;
    const queryResultId = executeResponse.data.query_result?.id;

    // If we got a job ID, poll for completion
    if (jobId && !queryResultId) {
      return this.waitForQueryResult<T>(queryId, jobId);
    }

    // If we got a cached result, fetch it
    if (queryResultId) {
      return this.fetchQueryResult<T>(queryId, queryResultId);
    }

    throw new Error('Unexpected response from Redash API');
  }

  async createQuery(params: {
    name: string;
    query: string;
    dataSourceId: number;
    description?: string;
    tags?: string[];
  }): Promise<number> {
    const response = await this.client.post('/api/queries', {
      name: params.name,
      query: params.query,
      data_source_id: params.dataSourceId,
      description: params.description ?? '',
      tags: params.tags ?? [],
    });

    return response.data.id;
  }

  async getDataSources(): Promise<Array<{ id: number; name: string; type: string }>> {
    const response = await this.client.get('/api/data_sources');
    return response.data.map(
      (ds: { id: number; name: string; type: string }) => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
      })
    );
  }

  async getQuery(
    queryId: number
  ): Promise<{ id: number; name: string; query: string; dataSourceId: number } | null> {
    try {
      const response = await this.client.get(`/api/queries/${queryId}`);
      return {
        id: response.data.id,
        name: response.data.name,
        query: response.data.query,
        dataSourceId: response.data.data_source_id,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async refreshQuery(queryId: number): Promise<void> {
    await this.client.post(`/api/queries/${queryId}/refresh`);
  }

  private async waitForQueryResult<T>(
    queryId: number,
    jobId: string
  ): Promise<RedashQueryResult<T>> {
    const maxAttempts = 60; // 60 seconds timeout
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jobResponse = await this.client.get(`/api/jobs/${jobId}`);
      const job = jobResponse.data.job;

      if (job.status === 3) {
        // Success
        return this.fetchQueryResult<T>(queryId, job.query_result_id);
      }

      if (job.status === 4) {
        // Failed
        throw new Error(`Query execution failed: ${job.error}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error('Query execution timed out');
  }

  private async fetchQueryResult<T>(
    queryId: number,
    resultId: number
  ): Promise<RedashQueryResult<T>> {
    const response = await this.client.get(
      `/api/queries/${queryId}/results/${resultId}.json`
    );

    const data = response.data.query_result;
    return {
      columns: data.data.columns,
      rows: data.data.rows as T[],
      metadata: {
        dataSourceId: data.data_source_id,
        queryId,
        retrievedAt: data.retrieved_at,
        runTime: data.runtime,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
