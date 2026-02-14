import type { BugWorkItem, CreateBugInput } from '../../models/index.js';

/**
 * Interface for Azure DevOps operations
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface IDevOpsAdapter {
  /**
   * Creates a new bug work item
   * @param input - Bug creation parameters
   * @returns The created bug work item with assigned ID
   */
  createBug(input: CreateBugInput): Promise<BugWorkItem>;

  /**
   * Updates an existing bug work item
   * @param id - Work item ID
   * @param updates - Fields to update
   */
  updateBug(
    id: number,
    updates: Partial<Omit<BugWorkItem, 'id' | 'relatedErrorId'>>
  ): Promise<BugWorkItem>;

  /**
   * Adds a comment to a work item
   * @param id - Work item ID
   * @param comment - Comment text
   */
  addComment(id: number, comment: string): Promise<void>;

  /**
   * Links a pull request to a work item
   * @param workItemId - Work item ID
   * @param prUrl - Pull request URL
   */
  linkPullRequest(workItemId: number, prUrl: string): Promise<void>;

  /**
   * Gets a work item by ID
   * @param id - Work item ID
   */
  getWorkItem(id: number): Promise<BugWorkItem | null>;

  /**
   * Closes a work item
   * @param id - Work item ID
   * @param reason - Resolution reason
   */
  closeWorkItem(id: number, reason: string): Promise<void>;
}
