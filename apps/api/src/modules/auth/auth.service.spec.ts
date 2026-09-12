import 'reflect-metadata';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@buildora/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as passwords from '../../common/utils/passwords';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let rootPrisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let txPrisma: {
    user: {
      create: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let jwtService: {
    sign: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    txPrisma = {
      user: {
        create: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    rootPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          // Pass txPrisma into transaction callback so we can assert on transactional behavior vs root client
          return cb(txPrisma);
        }
        return Promise.all(cb);
      }),
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-access-token'),
    };

    const configService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN_DAYS') return 7;
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: rootPrisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should atomically create user and initial refresh token record inside one transaction', async () => {
      txPrisma.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        passwordHash: '$argon2id$...',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      txPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-uuid-1',
        tokenHash: 'hash-1',
        userId: 'user-uuid-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });

      const result = await service.register({
        email: 'TEST@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(rootPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
      );
      expect(txPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-uuid-1',
          }),
        }),
      );
      expect(result.user.email).toBe('test@example.com');
      expect('passwordHash' in result.user).toBe(false);
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.rawRefreshToken).toBeDefined();
    });

    it('should throw ConflictException if P2002 unique collision occurs during registration', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      rootPrisma.$transaction.mockRejectedValue(p2002Error);

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens when credentials are valid', async () => {
      const hashedPassword = await passwords.hashPassword('Password123!');
      rootPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rootPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.rawRefreshToken).toBeDefined();
      expect(rootPrisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const hashedPassword = await passwords.hashPassword('CorrectPassword123!');
      rootPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      rootPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh token rotation & reuse detection semantics', () => {
    it('should atomically consume and rotate a valid refresh token within the same token family', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        role: 'USER',
      };
      txPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-1',
        familyId: 'family-123',
        userId: 'user-uuid-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      });
      txPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refresh('some-valid-raw-token');

      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.rawRefreshToken).toBeDefined();
      expect(txPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'token-uuid-1',
          isRevoked: false,
        },
        data: expect.objectContaining({ isRevoked: true }),
      });
      expect(txPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-uuid-1',
            familyId: 'family-123',
          }),
        }),
      );
    });

    it('should commit transaction on lost atomic race and revoke entire family via root client after transaction resolves', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        role: 'USER',
      };
      txPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-1',
        familyId: 'family-123',
        userId: 'user-uuid-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      });
      // Lost race: count is 0 because another concurrent transaction revoked it first
      txPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      rootPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      // The transaction resolves without throwing internally; then outside the transaction,
      // root client revokes the family and throws UnauthorizedException
      await expect(service.refresh('concurrent-raw-token')).rejects.toThrow(UnauthorizedException);

      // Verify transaction completed without creating replacement for loser
      expect(txPrisma.refreshToken.create).not.toHaveBeenCalled();

      // Verify root client was called after transaction to revoke the entire family
      expect(rootPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-123' },
        data: expect.objectContaining({ isRevoked: true }),
      });
    });

    it('should commit family revocation inside transaction for already revoked token, then throw outside transaction', async () => {
      txPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-revoked',
        familyId: 'family-compromised-456',
        userId: 'user-uuid-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: 'user-uuid-1' },
      });
      txPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh('compromised-raw-token')).rejects.toThrow(UnauthorizedException);

      // Transaction committed the revocation of the family
      expect(txPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-compromised-456' },
        data: expect.objectContaining({ isRevoked: true }),
      });
      expect(txPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should commit expired record revocation inside transaction, then throw outside transaction', async () => {
      txPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-expired',
        familyId: 'family-789',
        userId: 'user-uuid-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 10000), // Expired in past
        user: { id: 'user-uuid-1' },
      });
      txPrisma.refreshToken.update.mockResolvedValue({ id: 'token-uuid-expired', isRevoked: true });

      await expect(service.refresh('expired-raw-token')).rejects.toThrow(UnauthorizedException);

      // Transaction committed the expired record revocation
      expect(txPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-expired' },
        data: expect.objectContaining({ isRevoked: true }),
      });
      expect(txPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the active refresh token on logout', async () => {
      rootPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'active-token-id',
        isRevoked: false,
      });

      await service.logout('valid-logout-token');

      expect(rootPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'active-token-id' },
          data: expect.objectContaining({ isRevoked: true }),
        }),
      );
    });
  });
});
