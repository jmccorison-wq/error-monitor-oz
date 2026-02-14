import type { IDevOpsAdapter } from '../interfaces/index.js';
import type { BugWorkItem, CreateBugInput } from '../../models/index.js';

/**
 * Mock Azure DevOps adapter for testing and development
 */
export class MockDevOpsAdapter implements IDevOpsAdapter {
  private workItems: Map<number, BugWorkItem> = new Map();
  private comments: Map<number, string[]> = new Map();
  private idCounter = 1000;

  async createBug(input: CreateBugInput): Promise<BugWorkItem> {
    const id = this.idCounter++;
    const workItem: BugWorkItem = {
      id,
      title: input.title,
      description: input.description,
      reproSteps: input.reproSteps,
      systemInfo: input.systemInfo,
      priority: input.priority ?? 2,
      severity: input.severity ?? '2 - High',
      tags: input.tags ?? ['auto-fix'],
      assignedTo: input.assignedTo,
      areaPath: input.areaPath,
      iterationPath: input.iterationPath,
      relatedErrorId: input.relatedErrorId,
    };

    this.workItems.set(id, workItem);
    this.comments.set(id, []);

    return workItem;
  }

  async updateBug(
    id: number,
    updates: Partial<Omit<BugWorkItem, 'id' | 'relatedErrorId'>>
  ): Promise<BugWorkItem> {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Work item ${id} not found`);
    }

    const updated: BugWorkItem = {
      ...workItem,
      ...updates,
      id: workItem.id,
      relatedErrorId: workItem.relatedErrorId,
    };

    this.workItems.set(id, updated);
    return updated;
  }

  async addComment(id: number, comment: string): Promise<void> {
    const comments = this.comments.get(id) ?? [];
    comments.push(comment);
    this.comments.set(id, comments);
  }

  async linkPullRequest(workItemId: number, prUrl: string): Promise<void> {
    const workItem = this.workItems.get(workItemId);
    if (workItem) {
      workItem.pullRequestUrl = prUrl;
    }
  }

  async getWorkItem(id: number): Promise<BugWorkItem | null> {
    return this.workItems.get(id) ?? null;
  }

  async closeWorkItem(id: number, _reason: string): Promise<void> {
    const workItem = this.workItems.get(id);
    if (workItem) {
      // In a real implementation, this would set the state
      this.addComment(id, `Closed: ${_reason}`);
    }
  }

  // Helper methods for testing
  getComments(id: number): string[] {
    return this.comments.get(id) ?? [];
  }

  getAllWorkItems(): BugWorkItem[] {
    return Array.from(this.workItems.values());
  }

  clear(): void {
    this.workItems.clear();
    this.comments.clear();
    this.idCounter = 1000;
  }
}
