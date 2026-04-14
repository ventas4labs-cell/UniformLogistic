import { fetchFeConfig, fetchFeDocumentos } from '@/lib/services/feConfig';
import { FeConfigForm } from '@/components/admin/fe-config-form';
import { FeDocumentosTable } from '@/components/admin/fe-documentos-table';

export default async function AdminFacturacionPage() {
    const [config, documentos] = await Promise.all([
        fetchFeConfig(),
        fetchFeDocumentos(50)
    ]);

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Facturación Electrónica</h2>
                <p className="text-gray-500 text-sm">
                    Configuración del emisor y monitoreo de documentos enviados a Hacienda (v4.4).
                </p>
            </div>

            <FeConfigForm initialConfig={config} />

            <FeDocumentosTable documentos={documentos} />
        </div>
    );
}
