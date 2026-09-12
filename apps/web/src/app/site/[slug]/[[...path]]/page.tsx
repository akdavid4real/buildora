import { PublicSite } from '../../../../components/public-site';

export default function PublicSitePage({ params }: { params: { slug: string; path?: string[] } }) {
  return <PublicSite slug={params.slug} path={params.path ?? []} />;
}
