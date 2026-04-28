import { AuditResultsView } from "./AuditResultsView";

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  return <AuditResultsView auditId={params.id} />;
}
