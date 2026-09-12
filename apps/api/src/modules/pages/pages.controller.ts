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
  type CreatePageDto,
  type PageListQuery,
  type PageResponse,
  type PaginatedResponse,
  type UpdatePageDto,
  createPageSchema,
  pageListQuerySchema,
  updatePageSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PagesService } from './pages.service';

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId/pages')
export class PagesController {
  constructor(@Inject(PagesService) private readonly pagesService: PagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(createPageSchema)) dto: CreatePageDto,
  ): Promise<PageResponse> {
    return this.pagesService.createPage(userId, siteId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPages(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Query(new ZodValidationPipe(pageListQuerySchema)) query: PageListQuery,
  ): Promise<PaginatedResponse<PageResponse>> {
    return this.pagesService.listPages(userId, siteId, query);
  }

  @Get(':pageId')
  @HttpCode(HttpStatus.OK)
  async getPage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
  ): Promise<PageResponse> {
    return this.pagesService.getPage(userId, siteId, pageId);
  }

  @Patch(':pageId')
  @HttpCode(HttpStatus.OK)
  async updatePage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
    @Body(new ZodValidationPipe(updatePageSchema)) dto: UpdatePageDto,
  ): Promise<PageResponse> {
    return this.pagesService.updatePage(userId, siteId, pageId, dto);
  }

  @Delete(':pageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
  ): Promise<void> {
    return this.pagesService.deletePage(userId, siteId, pageId);
  }

  @Post(':pageId/publish')
  @HttpCode(HttpStatus.OK)
  async publishPage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
  ): Promise<PageResponse> {
    return this.pagesService.publishPage(userId, siteId, pageId);
  }

  @Post(':pageId/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublishPage(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('pageId', new ParseUUIDPipe({ version: '4' })) pageId: string,
  ): Promise<PageResponse> {
    return this.pagesService.unpublishPage(userId, siteId, pageId);
  }
}
