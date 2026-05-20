import {
    fetchFeDocumentos,
    summarizeFeDocumentos
} from '@/lib/services/feDocumentos';
import { FeDocumentosBoard } from '@/components/admin/fe-documentos-board';

export default async function AdminFacturacionDocumentosPage() {
    const documentos = await fetchFeDocumentos({ limit: 300 });
    const summary = summarizeFeDocumentos(documentos);
    return <FeDocumentosBoard documentos={documentos} summary={summary} />;
}
