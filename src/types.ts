export interface TestCase {
  id: string;
  scenario: string;
  message: string;
  criterion: string;
}

export interface TestResult {
  testCase: TestCase;
  response: string;
  pass: boolean;
  score: number;
  reason: string;
  fixSuggestion: string;
  status: 'pass' | 'fail' | 'timeout' | 'eval_error';
  durationMs: number;
}

export interface ScenarioResult {
  name: string;
  results: TestResult[];
  passCount: number;
  failCount: number;
}
