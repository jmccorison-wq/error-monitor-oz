import { MockDevOpsAdapter } from '../adapters/devops/MockDevOpsAdapter';

describe('MockDevOpsAdapter', () => {
  let adapter: MockDevOpsAdapter;

  beforeEach(() => {
    adapter = new MockDevOpsAdapter();
  });

  describe('createBug', () => {
    it('should create a bug work item', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      expect(bug.id).toBeDefined();
      expect(bug.title).toBe('Test Bug');
      expect(bug.relatedErrorId).toBe('err-001');
    });

    it('should assign default priority and severity', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      expect(bug.priority).toBe(2);
      expect(bug.severity).toBe('2 - High');
    });

    it('should use provided priority and severity', async () => {
      const bug = await adapter.createBug({
        title: 'Critical Bug',
        description: 'Critical description',
        priority: 1,
        severity: '1 - Critical',
        relatedErrorId: 'err-002',
      });
      
      expect(bug.priority).toBe(1);
      expect(bug.severity).toBe('1 - Critical');
    });
  });

  describe('updateBug', () => {
    it('should update bug fields', async () => {
      const bug = await adapter.createBug({
        title: 'Original Title',
        description: 'Original description',
        relatedErrorId: 'err-001',
      });
      
      const updated = await adapter.updateBug(bug.id!, {
        title: 'Updated Title',
        priority: 1,
      });
      
      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe(1);
    });

    it('should throw for non-existent work item', async () => {
      await expect(adapter.updateBug(99999, { title: 'Test' })).rejects.toThrow();
    });
  });

  describe('addComment', () => {
    it('should add comment to work item', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      await adapter.addComment(bug.id!, 'Test comment');
      
      const comments = adapter.getComments(bug.id!);
      expect(comments).toContain('Test comment');
    });
  });

  describe('linkPullRequest', () => {
    it('should link PR to work item', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      await adapter.linkPullRequest(bug.id!, 'https://github.com/test/repo/pull/1');
      
      const workItem = await adapter.getWorkItem(bug.id!);
      expect(workItem?.pullRequestUrl).toBe('https://github.com/test/repo/pull/1');
    });
  });

  describe('getWorkItem', () => {
    it('should return work item by id', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      const workItem = await adapter.getWorkItem(bug.id!);
      expect(workItem).toEqual(bug);
    });

    it('should return null for non-existent id', async () => {
      const workItem = await adapter.getWorkItem(99999);
      expect(workItem).toBeNull();
    });
  });

  describe('closeWorkItem', () => {
    it('should close work item with reason', async () => {
      const bug = await adapter.createBug({
        title: 'Test Bug',
        description: 'Test description',
        relatedErrorId: 'err-001',
      });
      
      await adapter.closeWorkItem(bug.id!, 'Fixed');
      
      const comments = adapter.getComments(bug.id!);
      expect(comments.some(c => c.includes('Fixed'))).toBe(true);
    });
  });
});
