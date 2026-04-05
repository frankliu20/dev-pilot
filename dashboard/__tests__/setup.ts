import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
