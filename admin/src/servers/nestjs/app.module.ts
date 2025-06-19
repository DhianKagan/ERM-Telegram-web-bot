import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MongooseSchemasModule } from './mongoose/mongoose.module.js';

@Module({
  imports: [MongooseSchemasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
