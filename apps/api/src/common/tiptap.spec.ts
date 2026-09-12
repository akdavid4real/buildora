import { describe, expect, it } from 'vitest';
import { EMPTY_TIPTAP_DOC, tiptapDocSchema, tiptapNodeSchema } from '@buildora/contracts';

describe('Tiptap Validation Contracts', () => {
  describe('EMPTY_TIPTAP_DOC', () => {
    it('should match canonical empty document shape', () => {
      const parsed = tiptapDocSchema.parse(EMPTY_TIPTAP_DOC);
      expect(parsed).toEqual({
        type: 'doc',
        content: [],
      });
    });
  });

  describe('Root Document Validation', () => {
    it('should reject documents without type "doc"', () => {
      expect(() =>
        tiptapDocSchema.parse({
          type: 'paragraph',
          content: [],
        }),
      ).toThrow();
    });

    it('should reject documents where content is not an array', () => {
      expect(() =>
        tiptapDocSchema.parse({
          type: 'doc',
          content: 'not an array',
        }),
      ).toThrow();
    });

    it('should strip arbitrary top-level document properties', () => {
      const input = {
        type: 'doc',
        content: [],
        maliciousKey: 'should-be-stripped',
        extraMetadata: { nested: 123 },
      };

      const parsed = tiptapDocSchema.parse(input);
      expect(parsed).toEqual({
        type: 'doc',
        content: [],
      });
      expect('maliciousKey' in parsed).toBe(false);
      expect('extraMetadata' in parsed).toBe(false);
    });
  });

  describe('Node and Attribute Validation', () => {
    it('should accept valid nested nodes and JSON-safe attributes', () => {
      const validDoc = {
        type: 'doc' as const,
        content: [
          {
            type: 'heading',
            attrs: { level: 1, textAlign: 'center' },
            content: [
              {
                type: 'text',
                text: 'Welcome to Buildora',
                marks: [
                  {
                    type: 'bold',
                  },
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com', target: '_blank' },
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            attrs: {
              customData: {
                nestedNumber: 42,
                nestedBool: true,
                nestedArray: ['a', 'b', null],
              },
            },
            content: [
              {
                type: 'text',
                text: 'A clean structured content paragraph.',
              },
            ],
          },
        ],
      };

      const parsed = tiptapDocSchema.parse(validDoc);
      expect(parsed.type).toBe('doc');
      expect(parsed.content).toHaveLength(2);
      expect(parsed.content[0].attrs).toEqual({ level: 1, textAlign: 'center' });
      expect(parsed.content[1].attrs?.customData).toEqual({
        nestedNumber: 42,
        nestedBool: true,
        nestedArray: ['a', 'b', null],
      });
    });

    it('should reject non-JSON programmatic values like functions or undefined in attrs', () => {
      const invalidDocWithFn = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {
              badAttr: () => 'execute code',
            },
          },
        ],
      };

      expect(() => tiptapDocSchema.parse(invalidDocWithFn)).toThrow();
    });

    it('should reject nodes with missing type', () => {
      expect(() =>
        tiptapNodeSchema.parse({
          attrs: { level: 2 },
        }),
      ).toThrow();
    });

    it('should strip arbitrary non-contract keys on nodes and marks', () => {
      const nodeWithExtras = {
        type: 'paragraph',
        text: 'hello',
        unrecognizedKey: 'extra',
        marks: [
          {
            type: 'italic',
            markExtra: 'stripped',
          },
        ],
      };

      const parsed = tiptapNodeSchema.parse(nodeWithExtras);
      expect(parsed).toEqual({
        type: 'paragraph',
        text: 'hello',
        marks: [
          {
            type: 'italic',
          },
        ],
      });
      expect('unrecognizedKey' in parsed).toBe(false);
      expect('markExtra' in (parsed.marks?.[0] || {})).toBe(false);
    });
  });
});
