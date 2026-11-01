import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE_NAME } from './index.js';

describe('@veritas/shared', () => {
  it('exposes its package name', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@veritas/shared');
  });
});
