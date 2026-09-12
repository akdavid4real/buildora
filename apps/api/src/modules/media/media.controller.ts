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
  type ConfirmMediaUploadDto,
  type MediaAssetResponse,
  type MediaListQuery,
  type PaginatedResponse,
  type RequestMediaUploadDto,
  type RequestMediaUploadResponse,
  type UpdateMediaAssetDto,
  confirmMediaUploadSchema,
  mediaListQuerySchema,
  requestMediaUploadSchema,
  updateMediaAssetSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MediaService } from './media.service';

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly mediaService: MediaService) {}

  @Post('upload-request')
  @HttpCode(HttpStatus.OK)
  async requestUpload(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(requestMediaUploadSchema)) dto: RequestMediaUploadDto,
  ): Promise<RequestMediaUploadResponse> {
    return this.mediaService.requestUpload(userId, siteId, dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  async confirmUpload(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(confirmMediaUploadSchema)) dto: ConfirmMediaUploadDto,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.confirmUpload(userId, siteId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listMedia(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Query(new ZodValidationPipe(mediaListQuerySchema)) query: MediaListQuery,
  ): Promise<PaginatedResponse<MediaAssetResponse>> {
    return this.mediaService.listMedia(userId, siteId, query);
  }

  @Get(':mediaId')
  @HttpCode(HttpStatus.OK)
  async getMedia(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.getMedia(userId, siteId, mediaId);
  }

  @Patch(':mediaId')
  @HttpCode(HttpStatus.OK)
  async updateMedia(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
    @Body(new ZodValidationPipe(updateMediaAssetSchema)) dto: UpdateMediaAssetDto,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.updateMedia(userId, siteId, mediaId, dto);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
  ): Promise<void> {
    return this.mediaService.deleteMedia(userId, siteId, mediaId);
  }
}
