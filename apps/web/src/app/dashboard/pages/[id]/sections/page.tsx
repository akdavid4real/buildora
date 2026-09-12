import { PageSectionBuilderView } from '../../../../../components/page-section-builder-view';

export default function PageSectionBuilderPage({ params }: { params: { id: string } }) {
  return <PageSectionBuilderView id={params.id} />;
}
