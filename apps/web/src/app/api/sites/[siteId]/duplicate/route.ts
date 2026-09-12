import { prisma } from '@buildora/database';
import { assertOwnedSite, jsonError } from '../../../../../server/hackathon';

export async function POST(_: Request, { params }: { params: { siteId: string } }) {
  try {
    const { user, site } = await assertOwnedSite(params.siteId);
    const [pages, posts] = await Promise.all([
      prisma.page.findMany({ where: { siteId: site.id } }),
      prisma.post.findMany({ where: { siteId: site.id } }),
    ]);

    const suffix = Date.now().toString(36);
    const duplicated = await prisma.$transaction(async (tx) => {
      const newSite = await tx.site.create({
        data: {
          ownerId: user.id,
          name: `${site.name} Copy`,
          slug: `${site.slug}-copy-${suffix}`,
          description: site.description,
          themeId: site.themeId,
          themeConfig: site.themeConfig,
        },
      });

      for (const page of pages) {
        await tx.page.create({
          data: {
            siteId: newSite.id,
            title: page.title,
            slug: page.slug,
            contentJson: page.contentJson,
            status: page.status,
            isHomepage: page.isHomepage,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            publishedAt: page.status === 'PUBLISHED' ? page.publishedAt ?? new Date() : null,
          },
        });
      }

      for (const post of posts) {
        await tx.post.create({
          data: {
            siteId: newSite.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            contentJson: post.contentJson,
            status: post.status,
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
            publishedAt: post.status === 'PUBLISHED' ? post.publishedAt ?? new Date() : null,
          },
        });
      }

      return newSite;
    });

    return Response.json(duplicated, { status: 201 });
  } catch {
    return jsonError('Unable to duplicate site', 400);
  }
}
