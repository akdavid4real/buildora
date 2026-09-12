import { Controller, Get, HttpCode, HttpStatus, Inject, Param } from '@nestjs/common';
import type { PublicSiteResponse } from '@buildora/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { SitesService } from './sites.service';

@Controller('public/sites')
export class PublicSitesController {
  constructor(@Inject(SitesService) private readonly sitesService: SitesService) {}

  @Public()
  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async getPublicSite(@Param('slug') slug: string): Promise<PublicSiteResponse> {
    return this.sitesService.getPublicSiteBySlug(slug);
  }
}
