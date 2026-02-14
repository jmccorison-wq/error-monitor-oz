import { MockGitHubAdapter } from '../adapters/github/MockGitHubAdapter';

describe('MockGitHubAdapter', () => {
  let adapter: MockGitHubAdapter;

  beforeEach(() => {
    adapter = new MockGitHubAdapter();
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      await adapter.createBranch('owner', 'repo', 'feature/new-branch');
      
      const commit = await adapter.getLatestCommit('owner', 'repo', 'feature/new-branch');
      expect(commit).not.toBeNull();
    });
  });

  describe('pushFiles', () => {
    it('should push files and return commit sha', async () => {
      await adapter.createBranch('owner', 'repo', 'test-branch');
      
      const sha = await adapter.pushFiles(
        'owner',
        'repo',
        'test-branch',
        [{ path: 'test.ts', content: 'console.log("test");' }],
        'Add test file'
      );
      
      expect(sha).toBeTruthy();
      expect(sha).toMatch(/^sha-/);
    });

    it('should store file contents', async () => {
      await adapter.createBranch('owner', 'repo', 'test-branch');
      await adapter.pushFiles(
        'owner',
        'repo',
        'test-branch',
        [{ path: 'src/file.ts', content: 'export const x = 1;' }],
        'Add file'
      );
      
      const file = await adapter.getFileContents('owner', 'repo', 'src/file.ts', 'test-branch');
      expect(file?.content).toBe('export const x = 1;');
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request', async () => {
      const pr = await adapter.createPullRequest({
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'Test body',
        head: 'feature-branch',
        base: 'main',
      });
      
      expect(pr.url).toContain('github.com/owner/repo/pull/');
      expect(pr.number).toBeGreaterThan(0);
    });

    it('should track created PRs', async () => {
      await adapter.createPullRequest({
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'Test body',
        head: 'feature-branch',
        base: 'main',
      });
      
      const prs = adapter.getPullRequests();
      expect(prs.length).toBe(1);
      expect(prs[0]?.title).toBe('Test PR');
    });
  });

  describe('getRepository', () => {
    it('should return repository info', async () => {
      const repo = await adapter.getRepository('owner', 'repo');
      
      expect(repo).not.toBeNull();
      expect(repo?.fullName).toBe('owner/repo');
      expect(repo?.defaultBranch).toBe('main');
    });
  });

  describe('searchRepositories', () => {
    it('should return search results', async () => {
      const results = await adapter.searchRepositories('user-service');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.name).toContain('user');
    });
  });
});
