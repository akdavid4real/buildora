import { PublicSite } from '../../../../components/public-site';
import { Storefront } from '../../../../components/storefront';

export default function PublicSitePage({ params }: { params: { slug: string; path?: string[] } }) {
  const path = params.path ?? [];
  if (path[0] === 'shop') return <Storefront slug={params.slug} productSlug={path[1]} />;
  return <PublicSite slug={params.slug} path={path} />;
}
