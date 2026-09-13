import { PublicSite } from '../../../../components/public-site';
import { Storefront } from '../../../../components/storefront';

export default function PublicSitePage({ params }: { params: { slug: string; path?: string[] } }) {
  const path = params.path ?? [];
  if (path[0] === 'shop' || path[0] === 'products') {
    return <Storefront slug={params.slug} productSlug={path[0] === 'shop' ? path[1] : undefined} />;
  }
  return <PublicSite slug={params.slug} path={path} />;
}
