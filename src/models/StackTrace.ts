/**
 * Represents a parsed stack trace
 */
export interface StackTrace {
  /** Original raw stack trace string */
  raw: string;
  /** Parsed stack frames */
  frames: StackFrame[];
  /** Programming language detected */
  language?: ProgrammingLanguage;
  /** Primary error message */
  errorMessage: string;
  /** Error type/class */
  errorType?: string;
}

/**
 * Represents a single frame in a stack trace
 */
export interface StackFrame {
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Function or method name */
  functionName?: string;
  /** Class name if applicable */
  className?: string;
  /** Whether this frame is from user code (vs library) */
  isUserCode: boolean;
  /** Repository this file belongs to */
  repository?: string;
}

export type ProgrammingLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'rust'
  | 'unknown';