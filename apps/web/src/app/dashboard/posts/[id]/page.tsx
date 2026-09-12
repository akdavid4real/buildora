import { ContentEditorView } from '../../../../components/content-editor-view';

export default function DashboardPostEditorPage({ params }: { params: { id: string } }) {
  return <ContentEditorView kind="posts" id={params.id} />;
}
