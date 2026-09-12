import type { GenerateAiContentDto, GenerateAiContentResponse } from '@buildora/contracts';
import { apiFetch } from './api-client';

export const aiApi = {
  generate(siteId: string, dto: GenerateAiContentDto): Promise<GenerateAiContentResponse> {
    return apiFetch<GenerateAiContentResponse>(`/sites/${siteId}/ai/generate`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
};
