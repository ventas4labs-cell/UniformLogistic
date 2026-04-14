// ─── Facturación Electrónica CR v4.4 — Constants ─────────────────────────

export const PAIS_CODIGO = "506";

export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  "01": "Factura Electrónica",
  "02": "Nota de Débito Electrónica",
  "03": "Nota de Crédito Electrónica",
  "04": "Tiquete Electrónico",
  "08": "Factura Electrónica de Compra",
  "10": "Recibo Electrónico de Pago",
};

export const TIPO_CEDULA_LABELS: Record<string, string> = {
  "01": "Cédula Física",
  "02": "Cédula Jurídica",
  "03": "DIMEX",
  "04": "NITE",
  "05": "Cliente extranjero no identificado",
};

export const CONDICION_VENTA: Record<string, string> = {
  "01": "Contado",
  "02": "Crédito",
  "03": "Consignación",
  "04": "Apartado",
  "05": "Arrendamiento con opción de compra",
  "06": "Arrendamiento en función financiera",
  "07": "Cobro a favor de un tercero",
  "08": "Servicios prestados al Estado a crédito",
  "09": "Pago del servicio prestado al Estado",
  "99": "Otros",
};

export const MEDIO_PAGO: Record<string, string> = {
  "01": "Efectivo",
  "02": "Tarjeta",
  "03": "Cheque",
  "04": "Transferencia / depósito bancario",
  "05": "Recaudado por terceros",
  "99": "Otros",
};

export const UNIDAD_MEDIDA: Record<string, string> = {
  Al: "Alquiler de uso",
  Cm: "Centímetro",
  d: "Día",
  g: "Gramo",
  h: "Hora",
  Kg: "Kilogramo",
  Km: "Kilómetro",
  L: "Litro",
  m: "Metro",
  m2: "Metro cuadrado",
  m3: "Metro cúbico",
  mL: "Mililitro",
  mm: "Milímetro",
  mn: "Minuto",
  Os: "Otros (especificar)",
  Sp: "Servicios profesionales",
  Spe: "Servicios personales",
  st: "Set",
  Unid: "Unidad",
};

export const CODIGO_TARIFA_IVA: Record<string, number> = {
  "01": 0,     // Exento
  "02": 1,     // Tarifa reducida 1%
  "03": 2,     // Tarifa reducida 2%
  "04": 4,     // Tarifa reducida 4%
  "05": 0,     // Transitorio 0%
  "06": 0,     // Transitorio 4%
  "07": 0,     // Transitorio 8%
  "08": 13,    // Tarifa general 13%
};

export const CODIGO_IMPUESTO = {
  IVA: "01",
  SELECTIVO_CONSUMO: "02",
  UNICO_COMBUSTIBLES: "03",
  BEBIDAS_ALCOHOLICAS: "04",
  BEBIDAS_ENVASADAS: "05",
  TABACO: "06",
  IVA_ESPECIAL: "07",
  IVA_CALCULO_ESPECIAL: "08",
  IMPUESTO_CEMENTO: "12",
  OTROS: "99",
};

export const NATURALEZA_DESCUENTO: Record<string, string> = {
  "01": "Descuento comercial",
  "02": "Descuento por volumen",
  "03": "Descuento por pronto pago",
  "04": "Descuento acordado entre partes",
  "05": "Descuento por temporada/estacional",
  "06": "Descuento por promoción",
  "07": "Descuento por devolución",
  "08": "Descuento por bonificación",
  "09": "Descuento por rebajas",
  "10": "Otros",
};

export const TIPO_DOC_EXONERACION: Record<string, string> = {
  "01": "Compras autorizadas",
  "02": "Ventas exentas a diplomáticos",
  "03": "Autorizado por ley especial",
  "04": "Exenciones Dirección General de Hacienda",
  "05": "Transitorio V",
  "06": "Transitorio IX",
  "07": "Transitorio XVII",
  "99": "Otros",
};

export const CODIGO_REFERENCIA: Record<string, string> = {
  "01": "Anula documento de referencia",
  "02": "Corrige texto de documento de referencia",
  "03": "Corrige monto de documento de referencia",
  "04": "Referencia a otro documento",
  "05": "Sustituye comprobante provisional por contingencia",
  "99": "Otros",
};

export const TIPO_MENSAJE_RECEPTOR: Record<string, string> = {
  "1": "Aceptado",
  "2": "Aceptado parcialmente",
  "3": "Rechazado",
};

export const PROVINCIAS: Record<string, string> = {
  "1": "San José",
  "2": "Alajuela",
  "3": "Cartago",
  "4": "Heredia",
  "5": "Guanacaste",
  "6": "Puntarenas",
  "7": "Limón",
};

// XML Namespaces
export const XML_NAMESPACES = {
  fe: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica",
  nd: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
  nc: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
  te: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico",
  fec: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra",
  mr: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor",
  ds: "http://www.w3.org/2000/09/xmldsig#",
  xsd: "http://www.w3.org/2001/XMLSchema",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
};

export const ROOT_ELEMENT_BY_TYPE: Record<string, { element: string; ns: string }> = {
  "01": { element: "FacturaElectronica", ns: XML_NAMESPACES.fe },
  "02": { element: "NotaDebitoElectronica", ns: XML_NAMESPACES.nd },
  "03": { element: "NotaCreditoElectronica", ns: XML_NAMESPACES.nc },
  "04": { element: "TiqueteElectronico", ns: XML_NAMESPACES.te },
  "08": { element: "FacturaElectronicaCompra", ns: XML_NAMESPACES.fec },
  "10": { element: "MensajeReceptor", ns: XML_NAMESPACES.mr },
};
