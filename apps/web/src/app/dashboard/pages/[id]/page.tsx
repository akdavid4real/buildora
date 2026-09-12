import { ContentEditorView } from '../../../../components/content-editor-view';

export default function DashboardPageEditorPage({ params }: { params: { id: string } }) {
  return <ContentEditorView kind="pages" id={params.id} />;
}
