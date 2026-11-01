import { Module } from '@nestjs/common';

// Root module of the worker process: queue processors only, no controllers. Filled in by W1-09.
@Module({})
export class WorkerModule {}
