import type { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api';

// Shared by main.ts and the e2e tests so both run the same HTTP setup.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
}
