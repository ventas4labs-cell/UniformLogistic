// ─── Facturación Electrónica CR v4.4 — PKCS#12 Certificate Loader ────────

import forge from "node-forge";

export interface P12CertificateData {
  privateKey: forge.pki.PrivateKey;
  certificate: forge.pki.Certificate;
  certPem: string;
  keyPem: string;
  /** Certificate expiry date (notAfter) */
  expiresAt: Date;
  /** Certificate subject common name */
  subjectCN: string;
  /** Days until certificate expires */
  daysUntilExpiry: number;
}

/**
 * Parse a PKCS#12 (.p12) file and extract the private key and X.509 certificate.
 *
 * @param p12Buffer - Raw bytes of the .p12 file
 * @param pin - PIN/password for the .p12 container (supports complex 14-char PINs
 *              with uppercase, lowercase, numbers, and symbols)
 * @returns The extracted private key, certificate, and their PEM representations
 */
export function loadP12Certificate(
  p12Buffer: Buffer,
  pin: string
): P12CertificateData {
  if (!p12Buffer || p12Buffer.length === 0) {
    throw new Error("P12 file buffer is empty or undefined.");
  }

  if (!pin) {
    throw new Error("P12 PIN is required.");
  }

  let p12Asn1: forge.asn1.Asn1;
  try {
    const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
    p12Asn1 = forge.asn1.fromDer(p12Der);
  } catch {
    throw new Error(
      "Failed to parse P12 file. The file may be corrupt or not a valid PKCS#12 container."
    );
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pin);
  } catch {
    throw new Error(
      "Failed to decrypt P12 file. The PIN may be incorrect or the file is corrupt."
    );
  }

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag =
    keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) {
    throw new Error(
      "No private key found in P12 file. Ensure the file contains a private key."
    );
  }
  const privateKey = keyBag.key;

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) {
    throw new Error(
      "No certificate found in P12 file. Ensure the file contains an X.509 certificate."
    );
  }
  const certificate = certBag.cert;

  const certPem = forge.pki.certificateToPem(certificate);
  const keyPem = forge.pki.privateKeyToPem(privateKey);

  // Extract expiry and subject info
  const expiresAt = certificate.validity.notAfter;
  const subjectCN = certificate.subject.getField("CN")?.value || "Unknown";
  const daysUntilExpiry = Math.floor(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return { privateKey, certificate, certPem, keyPem, expiresAt, subjectCN, daysUntilExpiry };
}
