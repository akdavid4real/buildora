import { prisma } from '@buildora/database';
import { NextResponse } from 'next/server';
import { ensureHackathonSchema } from '../../../../../server/hackathon';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    await ensureHackathonSchema();
    const site = await prisma.site.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        themeId: true,
        themeConfig: true,
        pages: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ isHomepage: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            slug: true,
            isHomepage: true,
            contentJson: true,
            seoTitle: true,
            seoDescription: true,
            updatedAt: true,
          },
        },
        posts: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            contentJson: true,
            seoTitle: true,
            seoDescription: true,
            publishedAt: true,
            updatedAt: true,
            coverImage: {
              select: { publicUrl: true },
            },
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ message: 'Site not found' }, { status: 404 });
    }

    const config = site.themeConfig && typeof site.themeConfig === 'object'
      ? (site.themeConfig as Record<string, unknown>)
      : {};
    let pages = site.pages;

    if (config.offerType === 'products' && !pages.some((page) => page.slug === 'shop')) {
      const shopPage = {
        id: `shop-${site.id}`,
        title: 'Shop',
        slug: 'shop',
        isHomepage: false,
        contentJson: { type: 'doc', content: [] },
        seoTitle: `Shop | ${site.name}`,
        seoDescription: `Shop products from ${site.name}.`,
        updatedAt: new Date(),
      };
      const homepage = pages.find((page) => page.isHomepage);
      const rest = pages.filter((page) => !page.isHomepage);
      pages = homepage ? [homepage, shopPage, ...rest] : [shopPage, ...rest];
    }

    return NextResponse.json({
      ...site,
      pages,
      posts: site.posts.map(({ coverImage, ...post }) => ({
        ...post,
        coverImageUrl: coverImage?.publicUrl ?? null,
      })),
    });
  } catch (error) {
    console.error('Public site load failed', error);
    return NextResponse.json({ message: 'Unable to load site' }, { status: 500 });
  }
}
