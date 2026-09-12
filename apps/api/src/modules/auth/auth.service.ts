import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@buildora/database';
import type { LoginDto, RegisterDto, UserResponse } from '@buildora/contracts';
import { generateOpaqueToken, hashToken } from '../../common/utils/crypto';
import { hashPassword, verifyPassword } from '../../common/utils/passwords';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthResult {
  user: UserResponse;
  accessToken: string;
  rawRefreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  rawRefreshToken: string;
}

type RefreshTxResult =
  | { status: 'NOT_FOUND' }
  | { status: 'ALREADY_REVOKED'; familyId: string }
  | { status: 'EXPIRED'; tokenId: string }
  | { status: 'RACE_LOST'; familyId: string }
  | {
      status: 'SUCCESS';
      user: User;
      nextRawToken: string;
    };

@Injectable()
export class AuthService {
  private readonly refreshExpiresInDays: number;
  private readonly accessExpiresIn: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.refreshExpiresInDays =
      this.configService?.get<number>('JWT_REFRESH_EXPIRES_IN_DAYS', 7) ?? 7;
    this.accessExpiresIn = this.configService?.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') ?? '15m';
  }

  /**
   * Sanitizes user record to ensure password hash is never leaked.
   */
  private sanitizeUser(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Generates a signed JWT access token.
   */
  private generateAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.accessExpiresIn,
    });
  }

  /**
   * Registers a new user and creates their initial refresh token record atomically
   * within a single database transaction.
   */
  async register(dto: RegisterDto, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const passwordHash = await hashPassword(dto.password);

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresInDays * 24 * 60 * 60 * 1000);

    try {
      const createdUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            name: dto.name?.trim() || null,
          },
        });

        await tx.refreshToken.create({
          data: {
            tokenHash,
            userId: user.id,
            expiresAt,
            userAgent,
            ipAddress,
          },
        });

        return user;
      });

      const accessToken = this.generateAccessToken(createdUser);

      return {
        user: this.sanitizeUser(createdUser),
        accessToken,
        rawRefreshToken: rawToken,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A user with this email address already exists.');
      }
      throw err;
    }
  }

  /**
   * Authenticates user via Argon2id verification and issues fresh tokens.
   */
  async login(dto: LoginDto, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, dto.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresInDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    const accessToken = this.generateAccessToken(user);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      rawRefreshToken: rawToken,
    };
  }

  /**
   * Transactional Refresh Token Rotation with Atomic Consumption & Reuse Protection.
   *
   * To prevent transaction rollback on security failures, the transaction returns a
   * discriminated sentinel result so mutations commit cleanly before exceptions are thrown.
   *
   * On a lost atomic-consume race, the transaction cleanly completes without issuing a replacement;
   * then the root client revokes the entire family to ensure even the winner's token is invalidated.
   */
  async refresh(
    rawRefreshToken: string | undefined,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<RefreshResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const nextRawToken = generateOpaqueToken();
    const nextTokenHash = hashToken(nextRawToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresInDays * 24 * 60 * 60 * 1000);

    const txResult: RefreshTxResult = await this.prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!tokenRecord) {
        return { status: 'NOT_FOUND' };
      }

      // Reuse detection: If presented token was already revoked, commit family revocation in tx
      if (tokenRecord.isRevoked) {
        await tx.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });
        return { status: 'ALREADY_REVOKED', familyId: tokenRecord.familyId };
      }

      // Expiration check: Commit expiration revocation in tx
      if (tokenRecord.expiresAt < new Date()) {
        await tx.refreshToken.update({
          where: { id: tokenRecord.id },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });
        return { status: 'EXPIRED', tokenId: tokenRecord.id };
      }

      // Atomic conditional consumption: Update only if currently unrevoked
      const consumeResult = await tx.refreshToken.updateMany({
        where: {
          id: tokenRecord.id,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      // If count !== 1, a concurrent request consumed this token simultaneously.
      // Do NOT create a replacement token for the loser. Return RACE_LOST sentinel.
      if (consumeResult.count !== 1) {
        return { status: 'RACE_LOST', familyId: tokenRecord.familyId };
      }

      // Issue replacement token inheriting the familyId
      await tx.refreshToken.create({
        data: {
          tokenHash: nextTokenHash,
          userId: tokenRecord.userId,
          familyId: tokenRecord.familyId,
          expiresAt,
          userAgent,
          ipAddress,
        },
      });

      return {
        status: 'SUCCESS',
        user: tokenRecord.user,
        nextRawToken,
      };
    });

    // Handle non-success outcomes outside the transaction callback so all DB mutations are committed
    if (txResult.status === 'NOT_FOUND') {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (txResult.status === 'ALREADY_REVOKED') {
      throw new UnauthorizedException('Invalid or compromised refresh token.');
    }

    if (txResult.status === 'EXPIRED') {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (txResult.status === 'RACE_LOST') {
      // Revoke the entire family using the root Prisma client to invalidate any winning replacement
      await this.prisma.refreshToken.updateMany({
        where: { familyId: txResult.familyId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
      throw new UnauthorizedException('Concurrent token reuse detected. Family revoked.');
    }

    const accessToken = this.generateAccessToken(txResult.user);

    return {
      accessToken,
      rawRefreshToken: txResult.nextRawToken,
    };
  }

  /**
   * Logs out user by revoking the presented refresh token.
   */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashToken(rawRefreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (tokenRecord && !tokenRecord.isRevoked) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    }
  }

  /**
   * Retrieves profile for the authenticated user.
   */
  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return this.sanitizeUser(user);
  }
}
