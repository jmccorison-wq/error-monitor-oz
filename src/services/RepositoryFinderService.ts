import type { IGitHubAdapter } from '../adapters/index.js';
import type { StackTrace, AuditLogError } from '../models/index.js';

/**
 * Service for identifying the repository associated with an error
 * Single Responsibility: Repository identification and mapping
 */
export class RepositoryFinderService {
  constructor(
    private readonly githubAdapter: IGitHubAdapter,
    private readonly repositoryMappings?: Map<string, string>
  ) {}

  /**
   * Finds the repository for a given error
   */
  async findRepository(
    error: AuditLogError,
    stackTrace: StackTrace
  ): Promise<RepositoryInfo | null> {
    // 1. Try to use repository from error record
    if (error.repository) {
      const repoInfo = await this.getRepositoryInfo(error.repository);
      if (repoInfo) {
        return repoInfo;
      }
    }

    // 2. Try to find from source mapping
    if (this.repositoryMappings?.has(error.source)) {
      const mappedRepo = this.repositoryMappings.get(error.source)!;
      const repoInfo = await this.getRepositoryInfo(mappedRepo);
      if (repoInfo) {
        return repoInfo;
      }
    }

    // 3. Try to identify from stack trace
    const repoFromStack = await this.findRepositoryFromStackTrace(stackTrace);
    if (repoFromStack) {
      return repoFromStack;
    }

    // 4. Try to search GitHub
    const searchResults = await this.searchForRepository(error, stackTrace);
    if (searchResults) {
      return searchResults;
    }

    return null;
  }

  /**
   * Gets repository info from a full name (owner/repo)
   */
  private async getRepositoryInfo(fullName: string): Promise<RepositoryInfo | null> {
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
      return null;
    }

    const repoData = await this.githubAdapter.getRepository(owner, repo);
    if (!repoData) {
      return null;
    }

    return {
      owner,
      name: repo,
      fullName: repoData.fullName,
      url: repoData.url,
      defaultBranch: repoData.defaultBranch,
    };
  }

  /**
   * Attempts to find repository from stack trace paths
   */
  private async findRepositoryFromStackTrace(
    stackTrace: StackTrace
  ): Promise<RepositoryInfo | null> {
    const userCodeFrames = stackTrace.frames.filter((f) => f.isUserCode);

    for (const frame of userCodeFrames) {
      // Look for repo patterns in file path
      // e.g., "/github.com/owner/repo/src/file.ts"
      const githubMatch = frame.filePath.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (githubMatch) {
        const [, owner, repo] = githubMatch;
        if (owner && repo) {
          const repoInfo = await this.getRepositoryInfo(`${owner}/${repo}`);
          if (repoInfo) {
            return repoInfo;
          }
        }
      }

      // Check if repository is stored in frame metadata
      if (frame.repository) {
        const repoInfo = await this.getRepositoryInfo(frame.repository);
        if (repoInfo) {
          return repoInfo;
        }
      }
    }

    return null;
  }

  /**
   * Searches GitHub for matching repository
   */
  private async searchForRepository(
    error: AuditLogError,
    stackTrace: StackTrace
  ): Promise<RepositoryInfo | null> {
    // Build search query from error source and stack trace
    const searchTerms: string[] = [];

    // Add source as a potential repo name
    if (error.source) {
      searchTerms.push(error.source);
    }

    // Add distinctive file names from stack trace
    const userCodeFrames = stackTrace.frames.filter((f) => f.isUserCode);
    for (const frame of userCodeFrames.slice(0, 3)) {
      const fileName = frame.filePath.split('/').pop()?.replace(/\.[^.]+$/, '');
      if (fileName && !searchTerms.includes(fileName)) {
        searchTerms.push(fileName);
      }
    }

    if (searchTerms.length === 0) {
      return null;
    }

    try {
      const results = await this.githubAdapter.searchRepositories(searchTerms.join(' '));
      if (results.length > 0) {
        const firstResult = results[0];
        if (firstResult) {
          return {
            owner: firstResult.owner,
            name: firstResult.name,
            fullName: firstResult.fullName,
            url: firstResult.url,
            defaultBranch: 'main', // Will be overwritten when we fetch repo details
          };
        }
      }
    } catch {
      // Search failed, return null
    }

    return null;
  }

  /**
   * Adds a repository mapping
   */
  addMapping(source: string, repository: string): void {
    if (!this.repositoryMappings) {
      return;
    }
    this.repositoryMappings.set(source, repository);
  }
}

export interface RepositoryInfo {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
}
