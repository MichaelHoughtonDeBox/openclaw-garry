import { DocumentPageView } from "@/components/mission/document-page-view"

type DocumentPageProps = {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params
  return <DocumentPageView documentId={id} />
}
