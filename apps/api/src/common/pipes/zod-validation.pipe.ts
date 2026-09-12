import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
    return result.data;
  }
}
