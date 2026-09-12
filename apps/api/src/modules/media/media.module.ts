import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3StorageService } from './s3-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [MediaService, S3StorageService],
  exports: [MediaService, S3StorageService],
})
export class MediaModule {}
