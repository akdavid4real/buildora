import 'reflect-metadata';
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let prisma: {
    site: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    aiGeneration: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const siteId = '660e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    prisma = {
      site: {
        findFirst: vi.fn(),
      },
      aiGeneration: {
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    configService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ownership enforcement', () => {
    it('should throw NotFoundException if user does not own the site on generateContent', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'TITLE',
          context: 'Some content',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not own the site on listLogs', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(service.listLogs(userId, siteId, { page: 1, limit: 10 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('configuration & limits', () => {
    it('should throw ServiceUnavailableException if MISTRAL_API_KEY is not configured', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string) => {
        if (key === 'MISTRAL_API_KEY') return undefined;
        return null;
      });

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'TITLE',
          context: 'Some content',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw 429 TooManyRequestsException when 20 successful daily generations are reached', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string) => {
        if (key === 'MISTRAL_API_KEY') return 'test-key';
        if (key === 'MISTRAL_MODEL') return 'mistral-small-latest';
        return null;
      });
      prisma.aiGeneration.count.mockResolvedValue(20);

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'TITLE',
          context: 'Some content',
        }),
      ).rejects.toSatisfy((error: unknown) => {
        return error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
      });
    });
  });

  describe('generateContent success & failure paths', () => {
    it('should successfully call Mistral, log success record without raw context, and return suggestion', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'MISTRAL_API_KEY') return 'test-api-key';
        if (key === 'MISTRAL_MODEL') return defaultValue || 'mistral-small-latest';
        return null;
      });
      prisma.aiGeneration.count.mockResolvedValue(0);
      prisma.aiGeneration.create.mockResolvedValue({ id: 'log-1' });

      const mockFetchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'cmpl-123',
          choices: [
            {
              message: {
                role: 'assistant',
                content: '1. Mastering Next.js\n2. The Ultimate Next.js Guide',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 35,
            completion_tokens: 22,
            total_tokens: 57,
          },
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockFetchResponse as unknown as Response);

      const result = await service.generateContent(userId, siteId, {
        actionType: 'TITLE',
        context: 'A comprehensive blog post about Next.js 14 App Router',
        instructions: 'Make them snappy',
        targetEntity: 'POST',
      });

      expect(result.actionType).toBe('TITLE');
      expect(result.suggestion).toBe('1. Mastering Next.js\n2. The Ultimate Next.js Guide');
      expect(result.tokensUsed.totalTokens).toBe(57);
      expect(prisma.aiGeneration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId,
            userId,
            actionType: 'TITLE',
            model: 'mistral-small-latest',
            promptTokens: 35,
            completionTokens: 22,
            totalTokens: 57,
            success: true,
            errorMessage: null,
            metadata: {
              targetEntity: 'POST',
              contextLength: 'A comprehensive blog post about Next.js 14 App Router'.length,
              instructionsLength: 'Make them snappy'.length,
            },
          }),
        }),
      );
    });

    it('should handle non-200 upstream response, log failure, and throw BadGatewayException', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'MISTRAL_API_KEY') return 'test-api-key';
        if (key === 'MISTRAL_MODEL') return defaultValue || 'mistral-small-latest';
        return null;
      });
      prisma.aiGeneration.count.mockResolvedValue(5);
      prisma.aiGeneration.create.mockResolvedValue({ id: 'log-fail-1' });

      const mockFetchResponse = {
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded upstream'),
      };
      global.fetch = vi.fn().mockResolvedValue(mockFetchResponse as unknown as Response);

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'EXCERPT',
          context: 'Some article content',
        }),
      ).rejects.toThrow(BadGatewayException);

      expect(prisma.aiGeneration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId,
            userId,
            actionType: 'EXCERPT',
            success: false,
            errorMessage: expect.stringContaining('Mistral API error (429)'),
          }),
        }),
      );
    });

    it('should handle empty completion from upstream, log failure, and throw BadGatewayException', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'MISTRAL_API_KEY') return 'test-api-key';
        if (key === 'MISTRAL_MODEL') return defaultValue || 'mistral-small-latest';
        return null;
      });
      prisma.aiGeneration.count.mockResolvedValue(0);
      prisma.aiGeneration.create.mockResolvedValue({ id: 'log-fail-2' });

      const mockFetchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'cmpl-empty',
          choices: [{ message: { role: 'assistant', content: '' } }],
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockFetchResponse as unknown as Response);

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'DRAFT',
          context: 'Context here',
        }),
      ).rejects.toThrow(BadGatewayException);

      expect(prisma.aiGeneration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            errorMessage: 'Received empty response from upstream AI service',
          }),
        }),
      );
    });

    it('should handle request timeout, log failure, and throw GatewayTimeoutException', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'MISTRAL_API_KEY') return 'test-api-key';
        if (key === 'MISTRAL_MODEL') return defaultValue || 'mistral-small-latest';
        return null;
      });
      prisma.aiGeneration.count.mockResolvedValue(0);
      prisma.aiGeneration.create.mockResolvedValue({ id: 'log-fail-timeout' });

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        service.generateContent(userId, siteId, {
          actionType: 'REWRITE',
          context: 'Context here',
        }),
      ).rejects.toThrow(GatewayTimeoutException);

      expect(prisma.aiGeneration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            errorMessage: expect.stringContaining('timed out'),
          }),
        }),
      );
    });
  });

  describe('listLogs', () => {
    it('should return paginated generation logs in { data, meta } format', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: siteId, ownerId: userId });
      prisma.aiGeneration.count.mockResolvedValue(1);
      prisma.aiGeneration.findMany.mockResolvedValue([
        {
          id: 'log-101',
          siteId,
          userId,
          actionType: 'TITLE',
          model: 'mistral-small-latest',
          promptTokens: 40,
          completionTokens: 20,
          totalTokens: 60,
          durationMs: 340,
          success: true,
          errorMessage: null,
          metadata: { targetEntity: 'POST' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.listLogs(userId, siteId, {
        page: 1,
        limit: 10,
        actionType: 'TITLE',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('log-101');
      expect(result.data[0].actionType).toBe('TITLE');
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.aiGeneration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            siteId,
            actionType: 'TITLE',
          }),
        }),
      );
    });
  });
});
