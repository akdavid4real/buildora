import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  type LoginDto,
  type RegisterDto,
  type UserResponse,
  loginSchema,
  registerSchema,
} from '@buildora/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../../common/utils/cookies';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly refreshExpiresInDays: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.refreshExpiresInDays = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_DAYS', 7);
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<{ user: UserResponse; accessToken: string }> {
    const userAgent = req.headers['user-agent'];
    const { user, accessToken, rawRefreshToken } = await this.authService.register(
      dto,
      userAgent,
      ip,
    );

    setRefreshTokenCookie(res, rawRefreshToken, this.refreshExpiresInDays, this.isProduction);

    return { user, accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<{ user: UserResponse; accessToken: string }> {
    const userAgent = req.headers['user-agent'];
    const { user, accessToken, rawRefreshToken } = await this.authService.login(dto, userAgent, ip);

    setRefreshTokenCookie(res, rawRefreshToken, this.refreshExpiresInDays, this.isProduction);

    return { user, accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<{ accessToken: string }> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const userAgent = req.headers['user-agent'];

    try {
      const { accessToken, rawRefreshToken: nextRefreshToken } = await this.authService.refresh(
        rawRefreshToken,
        userAgent,
        ip,
      );

      setRefreshTokenCookie(res, nextRefreshToken, this.refreshExpiresInDays, this.isProduction);

      return { accessToken };
    } catch (err) {
      // Clear cookie on invalid/expired/compromised refresh attempts
      clearRefreshTokenCookie(res, this.isProduction);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

    await this.authService.logout(rawRefreshToken);
    clearRefreshTokenCookie(res, this.isProduction);

    return { message: 'Logged out successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser('id') userId: string): Promise<UserResponse> {
    return this.authService.getMe(userId);
  }
}
