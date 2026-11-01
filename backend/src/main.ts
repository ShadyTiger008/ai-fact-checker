import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

// HTTP API entrypoint: controllers + queue producers only (heavy work runs in worker.ts).
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Read directly until the Zod-validated ConfigModule lands in W1-03.
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
