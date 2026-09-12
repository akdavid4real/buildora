import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HeadObjectResult {
  contentLength?: number;
  contentType?: string;
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string | null = null;
  private readonly endpoint: string | null = null;
  private readonly region: string;
  private readonly publicUrlBase: string | null = null;
  private readonly forcePathStyle: boolean;

  constructor(private readonly configService: ConfigService) {
    const bucket = this.configService.get<string>('S3_BUCKET');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    this.endpoint = this.configService.get<string>('S3_ENDPOINT') || null;
    this.region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    this.publicUrlBase = this.configService.get<string>('S3_PUBLIC_URL_BASE') || null;
    this.forcePathStyle = this.configService.get<boolean>('S3_FORCE_PATH_STYLE', true);

    if (bucket && accessKeyId && secretAccessKey) {
      this.bucket = bucket;
      this.s3Client = new S3Client({
        region: this.region,
        endpoint: this.endpoint || undefined,
        forcePathStyle: this.forcePathStyle,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(`S3 storage initialized (bucket: ${bucket}, region: ${this.region})`);
    } else {
      this.logger.warn(
        'S3 storage is unconfigured. Media upload and confirm operations will require S3 credentials.',
      );
    }
  }

  isConfigured(): boolean {
    return this.s3Client !== null && this.bucket !== null;
  }

  private ensureConfigured(): { client: S3Client; bucket: string } {
    if (!this.s3Client || !this.bucket) {
      throw new InternalServerErrorException(
        'S3 storage is not configured. Please set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables.',
      );
    }
    return { client: this.s3Client, bucket: this.bucket };
  }

  buildPublicUrl(s3Key: string): string {
    const trimmedKey = s3Key.replace(/^\/+/, '');
    if (this.publicUrlBase) {
      const base = this.publicUrlBase.replace(/\/+$/, '');
      return `${base}/${trimmedKey}`;
    }

    const bucket = this.bucket || 'bucket';
    if (this.endpoint) {
      const baseEndpoint = this.endpoint.replace(/\/+$/, '');
      if (this.forcePathStyle) {
        return `${baseEndpoint}/${bucket}/${trimmedKey}`;
      }
      return `${baseEndpoint.replace('://', `://${bucket}.`)}/${trimmedKey}`;
    }

    return `https://${bucket}.s3.${this.region}.amazonaws.com/${trimmedKey}`;
  }

  async generatePresignedUploadUrl(params: {
    s3Key: string;
    mimeType: string;
    sizeBytes: number;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { client, bucket } = this.ensureConfigured();
    const expiresIn = params.expiresInSeconds ?? 900;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.s3Key,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });

    return getSignedUrl(client, command, { expiresIn });
  }

  async headObject(s3Key: string): Promise<HeadObjectResult> {
    const { client, bucket } = this.ensureConfigured();

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      });
      const response = await client.send(command);
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
      };
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        message?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`Object "${s3Key}" not found in storage bucket`);
      }
      this.logger.error(
        `Error verifying object "${s3Key}" in S3: ${err?.message || String(error)}`,
      );
      throw error;
    }
  }

  async deleteObject(s3Key: string): Promise<void> {
    const { client, bucket } = this.ensureConfigured();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });
    await client.send(command);
  }
}
