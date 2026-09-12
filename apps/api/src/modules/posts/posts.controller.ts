import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type CreatePostDto,
  type PaginatedResponse,
  type PostListQuery,
  type PostResponse,
  type UpdatePostDto,
  createPostSchema,
  postListQuerySchema,
  updatePostSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PostsService } from './posts.service';

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId/posts')
export class PostsController {
  constructor(@Inject(PostsService) private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(createPostSchema)) dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createPost(userId, siteId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPosts(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Query(new ZodValidationPipe(postListQuerySchema)) query: PostListQuery,
  ): Promise<PaginatedResponse<PostResponse>> {
    return this.postsService.listPosts(userId, siteId, query);
  }

  @Get(':postId')
  @HttpCode(HttpStatus.OK)
  async getPost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
  ): Promise<PostResponse> {
    return this.postsService.getPost(userId, siteId, postId);
  }

  @Patch(':postId')
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
    @Body(new ZodValidationPipe(updatePostSchema)) dto: UpdatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.updatePost(userId, siteId, postId, dto);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
  ): Promise<void> {
    return this.postsService.deletePost(userId, siteId, postId);
  }

  @Post(':postId/publish')
  @HttpCode(HttpStatus.OK)
  async publishPost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
  ): Promise<PostResponse> {
    return this.postsService.publishPost(userId, siteId, postId);
  }

  @Post(':postId/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublishPost(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('postId', new ParseUUIDPipe({ version: '4' })) postId: string,
  ): Promise<PostResponse> {
    return this.postsService.unpublishPost(userId, siteId, postId);
  }
}
