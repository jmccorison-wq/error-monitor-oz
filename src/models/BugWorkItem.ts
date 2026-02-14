import type { ErrorSeverity } from './AuditLogError.js';

/**
 * Represents a bug work item in Azure DevOps
 */
export interface BugWorkItem {
  /** Work item ID */
  id?: number;
  /** Bug title */
  title: string;
  /** Bug description */
  description: string;
  /** Steps to reproduce */
  reproSteps?: string;
  /** System information */
  systemInfo?: string;
  /** Priority (1-4, 1 being highest) */
  priority: 1 | 2 | 3 | 4;
  /** Severity level */
  severity: '1 - Critical' | '2 - High' | '3 - Medium' | '4 - Low';
  /** Tags */
  tags?: string[];
  /** Assigned to */
  assignedTo?: string;
  /** Area path */
  areaPath?: string;
  /** Iteration path */
  iterationPath?: string;
  /** Related error ID from audit log */
  relatedErrorId: string;
  /** Bug fix branch name */
  bugBranch?: string;
  /** Pull request URL */
  pullRequestUrl?: string;
}

/**
 * Input for creating a new bug work item
 */
export interface CreateBugInput {
  title: string;
  description: string;
  reproSteps?: string;
  systemInfo?: string;
  priority?: 1 | 2 | 3 | 4;
  severity?: '1 - Critical' | '2 - High' | '3 - Medium' | '4 - Low';
  tags?: string[];
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  relatedErrorId: string;
}

/**
 * Maps error severity to bug priority
 */
export function mapErrorSeverityToBugPriority(severity: ErrorSeverity): 1 | 2 | 3 | 4 {
  switch (severity) {
    case 'critical':
      return 1;
    case 'error':
      return 2;
    case 'warning':
      return 3;
    case 'info':
      return 4;
    default:
      return 2;
  }
}

/**
 * Maps error severity to bug severity
 */
export function mapErrorSeverityToBugSeverity(
  severity: ErrorSeverity
): '1 - Critical' | '2 - High' | '3 - Medium' | '4 - Low' {
  switch (severity) {
    case 'critical':
      return '1 - Critical';
    case 'error':
      return '2 - High';
    case 'warning':
      return '3 - Medium';
    case 'info':
      return '4 - Low';
    default:
      return '2 - High';
  }
}
