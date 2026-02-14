import type { StackTrace, StackFrame, ProgrammingLanguage } from '../models/index.js';

/**
 * Service for parsing stack traces from various programming languages
 * Single Responsibility: Parsing and extracting information from stack traces
 */
export class StackTraceParserService {
  /**
   * Parses a raw stack trace string into a structured StackTrace object
   */
  parse(rawStackTrace: string, errorMessage?: string): StackTrace {
    const language = this.detectLanguage(rawStackTrace);
    const frames = this.parseFrames(rawStackTrace, language);
    const { message, type } = this.extractErrorInfo(rawStackTrace, errorMessage);

    return {
      raw: rawStackTrace,
      frames,
      language,
      errorMessage: message,
      errorType: type,
    };
  }

  /**
   * Detects the programming language from the stack trace format
   */
  private detectLanguage(stackTrace: string): ProgrammingLanguage {
    // TypeScript/JavaScript (Node.js style)
    if (/at\s+.*\s+\(.*\.(?:ts|js|tsx|jsx):\d+:\d+\)/.test(stackTrace)) {
      return stackTrace.includes('.ts') ? 'typescript' : 'javascript';
    }

    // Python
    if (/File ".*\.py", line \d+/.test(stackTrace)) {
      return 'python';
    }

    // Go
    if (/\.go:\d+/.test(stackTrace) && /goroutine/.test(stackTrace)) {
      return 'go';
    }

    // Java
    if (/at\s+[\w.]+\([\w.]+\.java:\d+\)/.test(stackTrace)) {
      return 'java';
    }

    // C#
    if (/at\s+[\w.]+\s+in\s+.*\.cs:line\s+\d+/.test(stackTrace)) {
      return 'csharp';
    }

    // Ruby
    if (/\.rb:\d+:in `/.test(stackTrace)) {
      return 'ruby';
    }

    // Rust
    if (/\.rs:\d+:\d+/.test(stackTrace) && /thread '.*' panicked/.test(stackTrace)) {
      return 'rust';
    }

    return 'unknown';
  }

  /**
   * Parses stack frames based on language
   */
  private parseFrames(stackTrace: string, language: ProgrammingLanguage): StackFrame[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.parseJavaScriptFrames(stackTrace);
      case 'python':
        return this.parsePythonFrames(stackTrace);
      case 'go':
        return this.parseGoFrames(stackTrace);
      case 'java':
        return this.parseJavaFrames(stackTrace);
      default:
        return this.parseGenericFrames(stackTrace);
    }
  }

  /**
   * Parses JavaScript/TypeScript stack frames
   */
  private parseJavaScriptFrames(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Pattern: "at FunctionName (path/to/file.ts:line:col)"
    // or "at path/to/file.ts:line:col"
    const framePattern =
      /at\s+(?:(?:(\w+(?:\.\w+)*)\.)?(\w+)\s+)?\(?([^():]+\.(?:ts|js|tsx|jsx|mjs|cjs)):(\d+):(\d+)\)?/;

    for (const line of lines) {
      const match = line.match(framePattern);
      if (match) {
        const [, className, functionName, filePath, lineNum, colNum] = match;
        frames.push({
          filePath: filePath ?? '',
          lineNumber: lineNum ? parseInt(lineNum, 10) : undefined,
          columnNumber: colNum ? parseInt(colNum, 10) : undefined,
          functionName: functionName,
          className: className,
          isUserCode: this.isUserCode(filePath ?? ''),
        });
      }
    }

    return frames;
  }

  /**
   * Parses Python stack frames
   */
  private parsePythonFrames(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Pattern: 'File "path/to/file.py", line 123, in function_name'
    const framePattern = /File "([^"]+\.py)", line (\d+)(?:, in (\w+))?/;

    for (const line of lines) {
      const match = line.match(framePattern);
      if (match) {
        const [, filePath, lineNum, functionName] = match;
        frames.push({
          filePath: filePath ?? '',
          lineNumber: lineNum ? parseInt(lineNum, 10) : undefined,
          functionName: functionName,
          isUserCode: this.isUserCode(filePath ?? ''),
        });
      }
    }

    return frames;
  }

  /**
   * Parses Go stack frames
   */
  private parseGoFrames(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Pattern: "path/to/file.go:123 +0x123"
    const framePattern = /([^\s]+\.go):(\d+)/;
    // Function pattern: "package.function(args)"
    const funcPattern = /^(\w+(?:\.\w+)*)\(.*\)$/;

    let currentFunction: string | undefined;

    for (const line of lines) {
      const funcMatch = line.trim().match(funcPattern);
      if (funcMatch) {
        currentFunction = funcMatch[1];
        continue;
      }

      const match = line.match(framePattern);
      if (match) {
        const [, filePath, lineNum] = match;
        const parts = currentFunction?.split('.') ?? [];
        frames.push({
          filePath: filePath ?? '',
          lineNumber: lineNum ? parseInt(lineNum, 10) : undefined,
          functionName: parts.pop(),
          className: parts.join('.'),
          isUserCode: this.isUserCode(filePath ?? ''),
        });
        currentFunction = undefined;
      }
    }

    return frames;
  }

  /**
   * Parses Java stack frames
   */
  private parseJavaFrames(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Pattern: "at package.Class.method(File.java:123)"
    const framePattern = /at\s+([\w.$]+)\.([\w$<>]+)\(([\w.]+):(\d+)\)/;

    for (const line of lines) {
      const match = line.match(framePattern);
      if (match) {
        const [, className, methodName, fileName, lineNum] = match;
        frames.push({
          filePath: fileName ?? '',
          lineNumber: lineNum ? parseInt(lineNum, 10) : undefined,
          functionName: methodName,
          className: className,
          isUserCode: this.isUserCode(className ?? ''),
        });
      }
    }

    return frames;
  }

  /**
   * Generic frame parser for unknown languages
   */
  private parseGenericFrames(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Generic pattern to find file:line references
    const fileLinePattern = /([^\s:()]+\.\w+):(\d+)/g;

    for (const line of lines) {
      let match;
      while ((match = fileLinePattern.exec(line)) !== null) {
        const [, filePath, lineNum] = match;
        if (filePath && !frames.some((f) => f.filePath === filePath)) {
          frames.push({
            filePath,
            lineNumber: lineNum ? parseInt(lineNum, 10) : undefined,
            isUserCode: this.isUserCode(filePath),
          });
        }
      }
    }

    return frames;
  }

  /**
   * Extracts error type and message from stack trace
   */
  private extractErrorInfo(
    stackTrace: string,
    providedMessage?: string
  ): { message: string; type?: string } {
    const firstLine = stackTrace.split('\n')[0]?.trim() ?? '';

    // JavaScript/TypeScript: "TypeError: message"
    const jsMatch = firstLine.match(/^(\w+Error):\s*(.+)$/);
    if (jsMatch) {
      return { type: jsMatch[1], message: jsMatch[2] ?? providedMessage ?? '' };
    }

    // Python: "package.ExceptionType: message"
    const pyMatch = firstLine.match(/^([\w.]+Error|[\w.]+Exception):\s*(.+)$/);
    if (pyMatch) {
      return { type: pyMatch[1], message: pyMatch[2] ?? providedMessage ?? '' };
    }

    return { message: providedMessage ?? firstLine };
  }

  /**
   * Determines if a file path is user code vs library/framework code
   */
  private isUserCode(path: string): boolean {
    const libraryPatterns = [
      /node_modules/,
      /site-packages/,
      /vendor/,
      /\.gem/,
      /dist-packages/,
      /internal\//,
      /<anonymous>/,
      /native/,
    ];

    return !libraryPatterns.some((pattern) => pattern.test(path));
  }
}
