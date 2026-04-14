// ─── Facturación Electrónica CR v4.4 — Types ────────────────────────────

export type TipoDocumento = "01" | "02" | "03" | "04" | "08" | "10";
export type TipoCedula = "01" | "02" | "03" | "04" | "05"; // fisico, juridico, dimex, nite, extranjero
export type SituacionComprobante = "1" | "2" | "3"; // normal, contingencia, sin internet
export type CodigoTarifa = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";
export type TipoMensajeReceptor = "1" | "2" | "3"; // aceptado, parcial, rechazado
export type EstadoHacienda = "pendiente" | "aceptado" | "aceptado_parcial" | "rechazado" | "procesando" | "error";
export type EstadoEnvio = "no_enviado" | "enviado" | "confirmado" | "error";
export type Ambiente = "staging" | "production";

export interface EmisorReceptor {
  nombre: string;
  tipo_identificacion: TipoCedula;
  numero_identificacion: string;
  nombre_comercial?: string;
  codigo_pais?: string;
  telefono?: string;
  correo?: string;
  ubicacion?: {
    provincia: string;
    canton: string;
    distrito: string;
    barrio?: string;
    otras_senas?: string;
  };
}

export interface Exoneracion {
  tipo_documento: string;
  numero_documento: string;
  nombre_institucion: string;
  fecha_emision: string;
  porcentaje_exoneracion: number;
  monto_exoneracion: number;
}

export interface LineaDetalle {
  numero_linea: number;
  codigo_cabys: string;
  codigo_comercial?: { tipo: string; codigo: string };
  cantidad: number;
  unidad_medida: string;
  detalle: string;
  precio_unitario: number;
  monto_total: number;
  descuento?: {
    monto: number;
    naturaleza: string;
  };
  subtotal: number;
  impuesto?: {
    codigo: string;
    codigo_tarifa: CodigoTarifa;
    tarifa: number;
    factor_iva?: number;
    monto: number;
    exoneracion?: Exoneracion;
  };
  impuesto_neto?: number;
  monto_total_linea: number;
}

export interface ResumenFactura {
  codigo_tipo_moneda?: { codigo_moneda: string; tipo_cambio: number };
  total_servicios_gravados: number;
  total_servicios_exentos: number;
  total_servicios_exonerados: number;
  total_mercancias_gravadas: number;
  total_mercancias_exentas: number;
  total_mercancias_exoneradas: number;
  total_gravado: number;
  total_exento: number;
  total_exonerado: number;
  total_venta: number;
  total_descuentos: number;
  total_venta_neta: number;
  total_impuesto: number;
  total_iva_devuelto?: number;
  total_otros_cargos?: number;
  total_comprobante: number;
}

export interface DocumentoElectronico {
  clave: string;
  consecutivo: string;
  tipo_documento: TipoDocumento;
  fecha_emision: string;
  situacion: SituacionComprobante;
  codigo_actividad: string;
  emisor: EmisorReceptor;
  receptor?: EmisorReceptor;
  condicion_venta: string;
  plazo_credito?: string;
  medio_pago: string[];
  lineas: LineaDetalle[];
  resumen: ResumenFactura;
  referencia?: {
    tipo_doc: TipoDocumento;
    numero: string;
    fecha_emision: string;
    codigo: string;
    razon: string;
  };
  otros_cargos?: {
    tipo_documento: string;
    numero_identidad?: string;
    nombre?: string;
    detalle: string;
    porcentaje?: number;
    monto_cargo: number;
  }[];
  informacion_referencia?: {
    tipo_doc: string;
    numero: string;
    fecha_emision: string;
    codigo: string;
    razon: string;
  };
}

export interface HaciendaToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: Date;
}

export interface HaciendaResponse {
  clave: string;
  fecha: string;
  "ind-estado": string;
  "respuesta-xml"?: string;
}

export interface ClaveParams {
  pais: string;
  fecha: Date;
  cedula: string;
  consecutivo: string;
  situacion: SituacionComprobante;
  codigo_seguridad?: string;
}

export interface ConsecutivoParams {
  sucursal: string;
  punto_venta: string;
  tipo_documento: TipoDocumento;
  secuencial: number;
}

export interface FEConfig {
  id: string;
  branch_id: string;
  environment: Ambiente;
  cedula_tipo: TipoCedula;
  cedula_numero: string;
  nombre_emisor: string;
  nombre_comercial?: string;
  codigo_actividad: string;
  sucursal: string;
  punto_venta: string;
  correo_emisor?: string;
  telefono_emisor?: string;
  provincia?: string;
  canton?: string;
  distrito?: string;
  barrio?: string;
  otras_senas?: string;
  hacienda_username: string;
  hacienda_password_encrypted: string;
  p12_certificate_path?: string;
  p12_pin_encrypted?: string;
}

export interface EmitInvoiceRequest {
  branch_id: string;
  order_id?: string;
  tipo_documento: TipoDocumento;
  situacion?: SituacionComprobante;
  codigo_actividad?: string;
  receptor?: EmisorReceptor;
  condicion_venta?: string;
  medio_pago?: string[];
  lineas: {
    codigo_cabys: string;
    detalle: string;
    cantidad: number;
    precio_unitario: number;
    unidad_medida?: string;
    descuento?: { monto: number; naturaleza: string };
    impuesto?: {
      codigo_tarifa: CodigoTarifa;
      tarifa: number;
      exoneracion?: Omit<Exoneracion, "monto_exoneracion">;
    };
  }[];
  referencia?: DocumentoElectronico["referencia"];
}
