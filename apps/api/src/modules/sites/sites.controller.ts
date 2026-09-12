import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateSiteDto,
  type SiteResponse,
  type UpdateSiteDto,
  createSiteSchema,
  updateSiteSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SitesService } from './sites.service';

@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SitesController {
  constructor(@Inject(SitesService) private readonly sitesService: SitesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSite(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createSiteSchema)) dto: CreateSiteDto,
  ): Promise<SiteResponse> {
    return this.sitesService.createSite(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listSites(@CurrentUser('id') userId: string): Promise<SiteResponse[]> {
    return this.sitesService.listSites(userId);
  }

  @Get(':siteId')
  @HttpCode(HttpStatus.OK)
  async getSite(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
  ): Promise<SiteResponse> {
    return this.sitesService.getSite(userId, siteId);
  }

  @Patch(':siteId')
  @HttpCode(HttpStatus.OK)
  async updateSite(
    @CurrentUser('id') userId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body(new ZodValidationPipe(updateSiteSchema)) dto: UpdateSiteDto,
  ): Promise<SiteResponse> {
    return this.sitesService.updateSite(userId, siteId, dto);
  }
}
