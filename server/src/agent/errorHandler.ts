export interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

class ErrorHandler {
  private errors: ErrorReport[] = [];
  
  report(error: Error, context: ErrorContext, severity: ErrorReport['severity'] = 'medium'): ErrorReport {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack,
      context,
      severity,
      resolved: false
    };
    
    this.errors.push(errorReport);
    this.logError(errorReport);
    
    return errorReport;
  }
  
  resolve(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }
  
  getErrors(): ErrorReport[] {
    return this.errors;
  }
  
  getUnresolvedErrors(): ErrorReport[] {
    return this.errors.filter(e => !e.resolved);
  }
  
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private logError(errorReport: ErrorReport): void {
    console.error(`[${errorReport.severity.toUpperCase()}] ${errorReport.context.operation}: ${errorReport.message}`);
    if (errorReport.stack) {
      console.error(errorReport.stack);
    }
  }
}

export const errorHandler = new ErrorHandler();
export { ErrorHandler };

export function analyzeError(fileId: string, error: string, evelynStyle?: boolean): ErrorReport {
  const errorObj = new Error(error);
  const errorContext: ErrorContext = {
    operation: `analyze_${fileId}`,
    component: 'error_analyzer',
    timestamp: new Date(),
    metadata: { fileId, evelynStyle }
  };
  
  return errorHandler.report(errorObj, errorContext);
}

export function analyzeErrors(fileId: string, errors: string[], evelynStyle?: boolean): ErrorReport[] {
  return errors.map(error => analyzeError(fileId, error, evelynStyle));
}

export function applyErrorFix(fileId: string, error: string, fixCode: string): boolean {
  const errorId = `fix_${fileId}_${Date.now()}`;
  console.log(`Applying fix for file ${fileId}, error: ${error}, fix: ${fixCode}`);
  return errorHandler.resolve(errorId);
}

export function detectCommonErrors(code: string, language?: string): ErrorReport[] {
  const errors: ErrorReport[] = [];
  
  // Simple common error detection
  if (code.includes('undefined') && code.includes('Cannot read property')) {
    errors.push(analyzeError('static_analysis', 'Potential undefined property access', true));
  }
  
  // Language-specific errors
  if (language === 'typescript' && code.includes(': any')) {
    errors.push(analyzeError('static_analysis', 'Implicit any type detected', true));
  }
  
  return errors;
}
