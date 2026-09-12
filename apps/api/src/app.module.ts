import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './common/config/env.schema';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { PagesModule } from './modules/pages/pages.module';
import { PostsModule } from './modules/posts/posts.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { SitesModule } from './modules/sites/sites.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The API runs from apps/api in the Bun workspace, while local settings
      // live at the monorepo root.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    SitesModule,
    PagesModule,
    PostsModule,
    MediaModule,
    AiModule,
  ],
})
export class AppModule {}
