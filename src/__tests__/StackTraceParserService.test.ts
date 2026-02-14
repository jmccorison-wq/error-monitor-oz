import { StackTraceParserService } from '../services/StackTraceParserService';

describe('StackTraceParserService', () => {
  let parser: StackTraceParserService;

  beforeEach(() => {
    parser = new StackTraceParserService();
  });

  describe('parse', () => {
    it('should parse JavaScript/TypeScript stack traces', () => {
      const stackTrace = `TypeError: Cannot read property 'map' of undefined
    at UserService.getUsers (/src/services/UserService.ts:45:23)
    at async UserController.list (/src/controllers/UserController.ts:12:18)
    at async /src/routes/users.ts:8:5`;

      const result = parser.parse(stackTrace);

      expect(result.language).toBe('typescript');
      expect(result.errorType).toBe('TypeError');
      expect(result.errorMessage).toBe("Cannot read property 'map' of undefined");
      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0].filePath).toContain('UserService.ts');
      expect(result.frames[0].lineNumber).toBe(45);
      expect(result.frames[0].isUserCode).toBe(true);
    });

    it('should parse Python stack traces', () => {
      const stackTrace = `Traceback (most recent call last):
  File "/app/main.py", line 42, in process_data
    result = parse_json(data)
  File "/app/utils/parser.py", line 15, in parse_json
    return json.loads(data)
ValueError: Invalid JSON`;

      const result = parser.parse(stackTrace);

      expect(result.language).toBe('python');
      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0].filePath).toContain('.py');
    });

    it('should identify user code vs library code', () => {
      const stackTrace = `Error: Something went wrong
    at UserService.doSomething (/src/services/UserService.ts:10:5)
    at node_modules/express/lib/router/layer.js:95:5`;

      const result = parser.parse(stackTrace);

      const userCodeFrames = result.frames.filter((f) => f.isUserCode);
      const libraryFrames = result.frames.filter((f) => !f.isUserCode);

      expect(userCodeFrames.length).toBeGreaterThan(0);
      expect(libraryFrames.length).toBeGreaterThan(0);
    });

    it('should handle provided error message', () => {
      const stackTrace = `at SomeFunction (/src/file.ts:10:5)`;
      const errorMessage = 'Custom error message';

      const result = parser.parse(stackTrace, errorMessage);

      expect(result.errorMessage).toBe(errorMessage);
    });

    it('should return unknown language for unrecognized formats', () => {
      const stackTrace = `Some random text that is not a stack trace`;

      const result = parser.parse(stackTrace);

      expect(result.language).toBe('unknown');
    });
  });
});
