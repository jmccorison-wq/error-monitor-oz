import type { IGitHubAdapter } from '../interfaces/index.js';

/**
 * Mock GitHub adapter for testing and development
 */
export class MockGitHubAdapter implements IGitHubAdapter {
  private branches: Map<string, string> = new Map(); // branch -> sha
  private files: Map<string, { content: string; sha: string }> = new Map();
  private pullRequests: Array<{
    number: number;
    url: string;
    title: string;
    head: string;
    base: string;
  }> = [];
  private prCounter = 1;

  constructor() {
    // Seed with default main branch
    this.branches.set('myorg/test-repo:main', 'initial-sha-123');
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    _fromBranch?: string
  ): Promise<void> {
    const key = `${owner}/${repo}:${branchName}`;
    const sourceKey = `${owner}/${repo}:${_fromBranch ?? 'main'}`;
    const sourceSha = this.branches.get(sourceKey) ?? 'default-sha';
    this.branches.set(key, sourceSha);
  }

  async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    _commitMessage: string
  ): Promise<string> {
    const newSha = `sha-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    for (const file of files) {
      const key = `${owner}/${repo}:${branch}:${file.path}`;
      this.files.set(key, { content: file.content, sha: newSha });
    }

    this.branches.set(`${owner}/${repo}:${branch}`, newSha);
    return newSha;
  }

  async createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ url: string; number: number }> {
    const number = this.prCounter++;
    const url = `https://github.com/${params.owner}/${params.repo}/pull/${number}`;

    this.pullRequests.push({
      number,
      url,
      title: params.title,
      head: params.head,
      base: params.base,
    });

    return { url, number };
  }

  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string } | null> {
    const branch = ref ?? 'main';
    const key = `${owner}/${repo}:${branch}:${path}`;
    return this.files.get(key) ?? null;
  }

  async getRepository(
    owner: string,
    repo: string
  ): Promise<{ defaultBranch: string; fullName: string; url: string } | null> {
    return {
      defaultBranch: 'main',
      fullName: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  async searchRepositories(
    query: string
  ): Promise<Array<{ owner: string; name: string; fullName: string; url: string }>> {
    // Return mock results based on query
    return [
      {
        owner: 'myorg',
        name: query.includes('user') ? 'user-service' : 'test-repo',
        fullName: `myorg/${query.includes('user') ? 'user-service' : 'test-repo'}`,
        url: `https://github.com/myorg/${query.includes('user') ? 'user-service' : 'test-repo'}`,
      },
    ];
  }

  async getLatestCommit(
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ sha: string; message: string; author: string } | null> {
    const key = `${owner}/${repo}:${branch}`;
    const sha = this.branches.get(key);
    if (!sha) return null;

    return {
      sha,
      message: 'Latest commit message',
      author: 'Test Author',
    };
  }

  // Helper methods for testing
  getPullRequests(): typeof this.pullRequests {
    return [...this.pullRequests];
  }

  setBranchSha(owner: string, repo: string, branch: string, sha: string): void {
    this.branches.set(`${owner}/${repo}:${branch}`, sha);
  }

  setFileContent(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string
  ): void {
    const key = `${owner}/${repo}:${branch}:${path}`;
    this.files.set(key, { content, sha: `sha-${Date.now()}` });
  }
}
