import { prisma } from '@buildora/database';
import { assertOwnedSite, getHackathonUser, jsonError } from '../../../../../../server/hackathon';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 1_500_000;

export async function POST(request: Request, { params }: { params: { siteId: string } }) {
  try {
    await assertOwnedSite(params.siteId);
    const user = await getHackathonUser();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) return jsonError('Image file is required');
    if (!ALLOWED_TYPES.has(file.type)) return jsonError('Only JPEG, PNG, WebP, and GIF images are supported');
    if (file.size > MAX_BYTES) return jsonError('Image must be 1.5MB or smaller');

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString('base64')}`;
    const id = crypto.randomUUID();

    const asset = await prisma.mediaAsset.create({
      data: {
        id,
        siteId: params.siteId,
        uploaderId: user.id,
        filename: `${id}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        s3Key: `turso-media:${id}`,
        publicUrl: dataUrl,
      },
    });

    return Response.json(asset, { status: 201 });
  } catch (error) {
    console.error('media upload failed', error);
    return jsonError('Unable to upload image', 400);
  }
}
