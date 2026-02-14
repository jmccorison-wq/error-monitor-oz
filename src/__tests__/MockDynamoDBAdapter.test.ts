import { MockDynamoDBAdapter } from '../adapters/dynamodb/MockDynamoDBAdapter';
import type { AuditLogError } from '../models/AuditLogError';

describe('MockDynamoDBAdapter', () => {
  let adapter: MockDynamoDBAdapter;

  beforeEach(() => {
    adapter = new MockDynamoDBAdapter();
  });

  describe('getUnprocessedErrors', () => {
    it('should return seeded sample errors', async () => {
      const errors = await adapter.getUnprocessedErrors();
      
      expect(errors.length).toBe(2);
      expect(errors.every(e => !e.processed)).toBe(true);
    });

    it('should filter by severity', async () => {
      const errors = await adapter.getUnprocessedErrors({ severity: ['critical'] });
      
      expect(errors.every(e => e.severity === 'critical')).toBe(true);
    });

    it('should filter by source', async () => {
      const errors = await adapter.getUnprocessedErrors({ source: 'user-service' });
      
      expect(errors.every(e => e.source === 'user-service')).toBe(true);
    });

    it('should respect limit', async () => {
      const errors = await adapter.getUnprocessedErrors({ limit: 1 });
      
      expect(errors.length).toBe(1);
    });
  });

  describe('getErrorById', () => {
    it('should return error by id', async () => {
      const error = await adapter.getErrorById('err-001');
      
      expect(error).not.toBeNull();
      expect(error?.id).toBe('err-001');
    });

    it('should return null for non-existent id', async () => {
      const error = await adapter.getErrorById('non-existent');
      
      expect(error).toBeNull();
    });
  });

  describe('markAsProcessed', () => {
    it('should mark error as processed', async () => {
      await adapter.markAsProcessed('err-001');
      
      const error = await adapter.getErrorById('err-001');
      expect(error?.processed).toBe(true);
    });

    it('should add metadata when provided', async () => {
      await adapter.markAsProcessed('err-001', { fixedBy: 'oz-agent' });
      
      const error = await adapter.getErrorById('err-001');
      expect(error?.metadata).toMatchObject({ fixedBy: 'oz-agent' });
    });
  });

  describe('updateErrorWithFixInfo', () => {
    it('should update error with fix information', async () => {
      await adapter.updateErrorWithFixInfo('err-001', {
        workItemId: 123,
        pullRequestUrl: 'https://github.com/test/repo/pull/1',
        branch: 'bug/fix-001',
        fixedAt: '2024-01-01T00:00:00Z',
      });
      
      const error = await adapter.getErrorById('err-001');
      expect(error?.metadata).toMatchObject({
        workItemId: 123,
        pullRequestUrl: 'https://github.com/test/repo/pull/1',
      });
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', async () => {
      const stats = await adapter.getErrorStats();
      
      expect(stats.totalUnprocessed).toBe(2);
      expect(Object.keys(stats.bySeverity).length).toBeGreaterThan(0);
      expect(Object.keys(stats.bySource).length).toBeGreaterThan(0);
    });

    it('should update stats after processing', async () => {
      await adapter.markAsProcessed('err-001');
      
      const stats = await adapter.getErrorStats();
      expect(stats.totalUnprocessed).toBe(1);
    });
  });

  describe('addError', () => {
    it('should add new error', async () => {
      const newError: AuditLogError = {
        id: 'err-new',
        timestamp: new Date().toISOString(),
        message: 'New error',
        stackTrace: 'at test (/test.ts:1:1)',
        severity: 'warning',
        source: 'test-service',
        environment: 'test',
        processed: false,
      };
      
      adapter.addError(newError);
      
      const error = await adapter.getErrorById('err-new');
      expect(error).toEqual(newError);
    });
  });

  describe('clear', () => {
    it('should clear all errors', async () => {
      adapter.clear();
      
      const errors = await adapter.getUnprocessedErrors();
      expect(errors.length).toBe(0);
    });
  });
});
