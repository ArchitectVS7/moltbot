/**
 * Shared TypeScript types for analysis system
 */

export interface TestPrompt {
  testId: string;
  testName: string;
  category: string;
  turns: Array<{
    turnNumber: number;
    prompt: string;
    expectedBehavior?: string;
  }>;
  successCriteria: {
    taskCompleted: boolean;
    contextRetained: boolean;
    codeWorks: boolean;
  };
}

export interface SessionResult {
  testId: string;
  mode: 'baseline' | 'vs7';
  timestamp: number;
  turns: Array<{
    turnNumber: number;
    prompt: string;
    response: string;
    filesModified: string[];
    tokensUsed: number;
  }>;
  totalTokens: number;
  duration: number;
  success: boolean;
}

export interface LanguageAnalysis {
  language: string;
  fileCount: number;
  syntaxValid: boolean;
  hasTests: boolean;
  hasDocumentation: boolean;
  complexityScore: number;
  errorHandlingScore: number;
}

export interface CodeQualityMetrics {
  fileOrganization: number; // 0-100
  errorHandling: number; // 0-100
  documentation: number; // 0-100
  codeReadability: number; // 0-100
  overallScore: number; // 0-100
}

export interface SpecAdherence {
  score: number; // 0-100
  featuresImplemented: string[];
  featuresMissing: string[];
  successCriteriaMet: {
    taskCompleted: boolean;
    contextRetained: boolean;
    codeWorks: boolean;
  };
}

export interface ModeAnalysis {
  filesGenerated: number;
  languages: string[];
  languageAnalysis: LanguageAnalysis[];
  specAdherence: SpecAdherence;
  codeQuality: CodeQualityMetrics;
  testsPassed: boolean;
  strengths: string[];
  weaknesses: string[];
  totalTokens: number;
  generatedFiles: string[];
}

export interface TestComparison {
  winner: 'baseline' | 'vs7' | 'tie';
  filesDelta: string;
  tokensDelta: string;
  qualityDelta: string;
  specAdherenceDelta: string;
  summary: string;
  recommendations: string[];
}

export interface TestAnalysis {
  testId: string;
  testName: string;
  category: string;
  baseline: ModeAnalysis;
  vs7: ModeAnalysis;
  comparison: TestComparison;
}

export interface GroupAnalysis {
  groupId: string;
  tests: TestAnalysis[];
  summary: {
    totalTests: number;
    baselineWins: number;
    vs7Wins: number;
    ties: number;
    averageQuality: {
      baseline: number;
      vs7: number;
    };
    averageSpecAdherence: {
      baseline: number;
      vs7: number;
    };
  };
}

export interface AggregatedReport {
  timestamp: number;
  totalTests: number;
  groups: GroupAnalysis[];
  overallMetrics: {
    totalFilesGenerated: {
      baseline: number;
      vs7: number;
      delta: string;
    };
    totalTokensUsed: {
      baseline: number;
      vs7: number;
      delta: string;
    };
    averageSpecAdherence: {
      baseline: number;
      vs7: number;
    };
    averageCodeQuality: {
      baseline: number;
      vs7: number;
    };
    testsPassed: {
      baseline: number;
      vs7: number;
    };
  };
  categoryBreakdown: {
    category: string;
    baseline: number;
    vs7: number;
  }[];
  whatWentWell: string[];
  vs7Excelled: string[];
  baselineBetter: string[];
  areasForImprovement: string[];
  recommendations: string[];
}

export interface ValidationReport {
  timestamp: number;
  analysisValid: boolean;
  webShowcaseValid: boolean;
  testsRun: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    location?: string;
  }>;
  recommendations: string[];
}
