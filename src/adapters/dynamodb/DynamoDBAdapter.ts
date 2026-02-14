import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { IDynamoDBAdapter } from '../interfaces/index.js';
import type { AuditLogError, AuditLogErrorFilter, ErrorSeverity } from '../../models/index.js';

/**
 * DynamoDB adapter implementation for audit log operations
 */
export class DynamoDBAdapter implements IDynamoDBAdapter {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;

  constructor(config: { region: string; tableName: string }) {
    this.client = new DynamoDBClient({ region: config.region });
    this.tableName = config.tableName;
  }

  async getUnprocessedErrors(filter?: AuditLogErrorFilter): Promise<AuditLogError[]> {
    const filterExpressions: string[] = ['processed = :processed'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':processed': false,
    };

    if (filter?.severity && filter.severity.length > 0) {
      const severityPlaceholders = filter.severity.map((_, i) => `:sev${i}`);
      filterExpressions.push(`severity IN (${severityPlaceholders.join(', ')})`);
      filter.severity.forEach((sev, i) => {
        expressionAttributeValues[`:sev${i}`] = sev;
      });
    }

    if (filter?.source) {
      filterExpressions.push('source = :source');
      expressionAttributeValues[':source'] = filter.source;
    }

    if (filter?.since) {
      filterExpressions.push('#ts >= :since');
      expressionAttributeValues[':since'] = filter.since;
    }

    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ExpressionAttributeNames: filter?.since ? { '#ts': 'timestamp' } : undefined,
      Limit: filter?.limit,
    });

    const response = await this.client.send(command);
    const items = response.Items ?? [];

    return items.map((item) => this.mapToAuditLogError(unmarshall(item)));
  }

  async getErrorById(id: string): Promise<AuditLogError | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
    });

    const response = await this.client.send(command);

    if (!response.Item) {
      return null;
    }

    return this.mapToAuditLogError(unmarshall(response.Item));
  }

  async markAsProcessed(id: string, metadata?: Record<string, unknown>): Promise<void> {
    const updateExpressions = ['processed = :processed', 'processedAt = :processedAt'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':processed': true,
      ':processedAt': new Date().toISOString(),
    };

    if (metadata) {
      updateExpressions.push('processingMetadata = :metadata');
      expressionAttributeValues[':metadata'] = metadata;
    }

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
    });

    await this.client.send(command);
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
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};

    if (fixInfo.workItemId !== undefined) {
      updateExpressions.push('workItemId = :workItemId');
      expressionAttributeValues[':workItemId'] = fixInfo.workItemId;
    }

    if (fixInfo.pullRequestUrl) {
      updateExpressions.push('pullRequestUrl = :prUrl');
      expressionAttributeValues[':prUrl'] = fixInfo.pullRequestUrl;
    }

    if (fixInfo.branch) {
      updateExpressions.push('fixBranch = :branch');
      expressionAttributeValues[':branch'] = fixInfo.branch;
    }

    if (fixInfo.fixedAt) {
      updateExpressions.push('fixedAt = :fixedAt');
      expressionAttributeValues[':fixedAt'] = fixInfo.fixedAt;
    }

    if (updateExpressions.length === 0) {
      return;
    }

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ id }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
    });

    await this.client.send(command);
  }

  async getErrorStats(): Promise<{
    totalUnprocessed: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'processed = :processed',
      ExpressionAttributeValues: marshall({ ':processed': false }),
      ProjectionExpression: 'severity, source',
    });

    const response = await this.client.send(command);
    const items = response.Items ?? [];

    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const item of items) {
      const record = unmarshall(item);
      const severity = record['severity'] as string;
      const source = record['source'] as string;

      bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
      bySource[source] = (bySource[source] ?? 0) + 1;
    }

    return {
      totalUnprocessed: items.length,
      bySeverity,
      bySource,
    };
  }

  private mapToAuditLogError(item: Record<string, unknown>): AuditLogError {
    return {
      id: item['id'] as string,
      timestamp: item['timestamp'] as string,
      message: item['message'] as string,
      stackTrace: item['stackTrace'] as string,
      severity: item['severity'] as ErrorSeverity,
      source: item['source'] as string,
      environment: item['environment'] as string,
      commitSha: item['commitSha'] as string | undefined,
      repository: item['repository'] as string | undefined,
      processed: item['processed'] as boolean,
      metadata: item['metadata'] as Record<string, unknown> | undefined,
    };
  }
}
