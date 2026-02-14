/**
 * Interface for GitHub operations
 * Follows Dependency Inversion Principle - high-level modules depend on this abstraction
 */
export interface IGitHubAdapter {
  /**
   * Creates a new branch from the default branch
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branchName - Name for the new branch
   * @param fromBranch - Optional source branch (defaults to default branch)
   */
  createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranch?: string
  ): Promise<void>;

  /**
   * Pushes files to a branch
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Target branch
   * @param files - Files to push
   * @param commitMessage - Commit message
   */
  pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string
  ): Promise<string>; // Returns commit SHA

  /**
   * Creates a pull request
   * @param params - PR parameters
   * @returns PR URL and number
   */
  createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ url: string; number: number }>;

  /**
   * Gets file contents from a repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param ref - Optional branch/commit ref
   */
  getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string } | null>;

  /**
   * Gets repository information
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  getRepository(
    owner: string,
    repo: string
  ): Promise<{
    defaultBranch: string;
    fullName: string;
    url: string;
  } | null>;

  /**
   * Searches for repositories matching criteria
   * @param query - Search query
   */
  searchRepositories(query: string): Promise<
    Array<{
      owner: string;
      name: string;
      fullName: string;
      url: string;
    }>
  >;

  /**
   * Gets the latest commit on a branch
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Branch name
   */
  getLatestCommit(
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ sha: string; message: string; author: string } | null>;
}
