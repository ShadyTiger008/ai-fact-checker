import { Test } from '@nestjs/testing';
import { SHARED_PACKAGE_NAME } from '@veritas/shared';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('@veritas/shared workspace link', () => {
  it('resolves from the backend', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@veritas/shared');
  });
});
