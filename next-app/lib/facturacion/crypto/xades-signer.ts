// ─── Facturación Electrónica CR v4.4 — XAdES-EPES XML Signer ─────────────
//
// Uses xml-crypto's ExclusiveCanonicalization for proper C14N and
// node-forge for RSA-SHA256 signing + .p12 certificate handling.

import crypto from "crypto";
import forge from "node-forge";
import { DOMParser } from "@xmldom/xmldom";
import { ExclusiveCanonicalization } from "xml-crypto";
import { loadP12Certificate } from "./p12-loader";

// ─── Namespace URIs ──────────────────────────────────────────────────────
const NS_DS = "http://www.w3.org/2000/09/xmldsig#";
const NS_XADES = "http://uri.etsi.org/01903/v1.3.2#";

const c14n = new ExclusiveCanonicalization();
const domParser = new DOMParser();

/**
 * Canonicalize an XML string using Exclusive C14N (without comments).
 * Parses the string into a DOM, then applies exc-c14n to the root element.
 *
 * @param ancestorNamespaces - Namespace context inherited from ancestor elements.
 *   When canonicalizing a subset (e.g. SignedInfo within ds:Signature), namespaces
 *   declared by ancestors are NOT re-emitted on the child. This is critical for
 *   signature verification: Hacienda processes SignedInfo within the ds:Signature
 *   context where xmlns:ds is inherited, so exc-c14n does not include it on SignedInfo.
 *   Our standalone computation must match by passing the same ancestor context.
 */
function canonicalize(
  xmlStr: string,
  ancestorNamespaces: Array<{ prefix: string; namespaceURI: string }> = []
): string {
  const doc = domParser.parseFromString(xmlStr, "text/xml");
  const root = doc.documentElement;
  if (!root) {
    throw new Error("Failed to parse XML: no root element");
  }
  // xml-crypto types expect a DOM Element; @xmldom provides a structurally compatible one.
  return c14n.process(root as unknown as Element, { ancestorNamespaces, inclusiveNamespacesPrefixList: [] });
}

/**
 * Compute SHA-256 digest of a string, return base64-encoded.
 */
function sha256Base64(data: string): string {
  const md = forge.md.sha256.create();
  md.update(data, "utf8");
  return forge.util.encode64(md.digest().bytes());
}

/**
 * Sign an XML document using XAdES-EPES (Costa Rica Hacienda v4.4).
 *
 * Uses proper Exclusive C14N (via xml-crypto) for all digest computations
 * and SignedInfo canonicalization to ensure Hacienda's verifier produces
 * identical hashes.
 */
export function signXml(
  xmlString: string,
  p12Buffer: Buffer,
  pin: string
): string {
  const { certificate, certPem, keyPem } = loadP12Certificate(
    p12Buffer,
    pin
  );

  // ── 1. Prepare certificate data ────────────────────────────────────────
  const certBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\r?\n/g, "");

  const certDer = forge.util.decode64(certBase64);
  const certDigest = forge.md.sha256.create().update(certDer).digest();
  const certDigestBase64 = forge.util.encode64(certDigest.bytes());

  const issuerName = certificate.issuer.attributes
    .map((attr) => `${attr.shortName}=${attr.value}`)
    .join(", ");
  const serialNumber = certificate.serialNumber;

  // ── 2. Remove placeholder signature ────────────────────────────────────
  xmlString = xmlString.replace(
    /<ds:Signature[^>]*Id="placeholder"[^/]*\/>/g,
    ""
  );

  // ── 3. Compute document content digest using proper exc-c14n ──────────
  // Parse the full XML, get root element, canonicalize it.
  // This is what Hacienda does: enveloped-signature (remove ds:Signature)
  // + exc-c14n. Since we haven't added the signature yet, the result is
  // the canonicalized document without any signature.
  const xmlWithoutDecl = xmlString.replace(/<\?xml[^?]*\?>\s*/, "").trim();
  const contentCanonical = canonicalize(xmlWithoutDecl);
  const contentDigestBase64 = sha256Base64(contentCanonical);

  // ── 4. Generate IDs and signing time ──────────────────────────────────
  const signingTime = new Date().toISOString();
  const signatureId = `xmldsig-${forge.util.bytesToHex(forge.random.getBytesSync(8))}`;
  const signedPropertiesId = `${signatureId}-signedprops`;
  const keyInfoId = `${signatureId}-keyinfo`;

  // ── 5. Build and digest SignedProperties ──────────────────────────────
  // Build the XML with namespace declarations on the root (as exc-c14n
  // would render them for a standalone subset).
  const signedPropertiesXml = [
    `<xades:SignedProperties xmlns:ds="${NS_DS}" xmlns:xades="${NS_XADES}" Id="${signedPropertiesId}">`,
    `<xades:SignedSignatureProperties>`,
    `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `<xades:SigningCertificate>`,
    `<xades:Cert>`,
    `<xades:CertDigest>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>`,
    `<ds:DigestValue>${certDigestBase64}</ds:DigestValue>`,
    `</xades:CertDigest>`,
    `<xades:IssuerSerial>`,
    `<ds:X509IssuerName>${escapeXml(issuerName)}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber>${parseInt(serialNumber, 16)}</ds:X509SerialNumber>`,
    `</xades:IssuerSerial>`,
    `</xades:Cert>`,
    `</xades:SigningCertificate>`,
    `<xades:SignaturePolicyIdentifier>`,
    `<xades:SignaturePolicyId>`,
    `<xades:SigPolicyId>`,
    `<xades:Identifier>https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/Resolucion_Comprobantes_Electronicos_DGT-R-48-2016.pdf</xades:Identifier>`,
    `</xades:SigPolicyId>`,
    `<xades:SigPolicyHash>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>`,
    `<ds:DigestValue>V8lVYMGIbBSTXsOfEEBCbfEzCq6oO2BhCjI3Dg30VA0=</ds:DigestValue>`,
    `</xades:SigPolicyHash>`,
    `</xades:SignaturePolicyId>`,
    `</xades:SignaturePolicyIdentifier>`,
    `</xades:SignedSignatureProperties>`,
    `</xades:SignedProperties>`,
  ].join("");

  // Ancestor namespace context: SignedProperties lives inside
  // ds:Signature > ds:Object > xades:QualifyingProperties
  // Both ds: and xades: are declared on ancestors.
  const signatureAncestorNs = [
    { prefix: "ds", namespaceURI: NS_DS },
    { prefix: "xades", namespaceURI: NS_XADES },
  ];

  // Canonicalize and digest SignedProperties (with ancestor context)
  const signedPropsCanonical = canonicalize(signedPropertiesXml, signatureAncestorNs);
  const signedPropsDigestBase64 = sha256Base64(signedPropsCanonical);

  // ── 6. Build and digest KeyInfo ───────────────────────────────────────
  const keyInfoXml =
    `<ds:KeyInfo xmlns:ds="${NS_DS}" Id="${keyInfoId}">` +
    `<ds:X509Data>` +
    `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
    `</ds:X509Data>` +
    `</ds:KeyInfo>`;

  // KeyInfo is a direct child of ds:Signature (ancestor declares ds: and xades:)
  const keyInfoCanonical = canonicalize(keyInfoXml, signatureAncestorNs);
  const keyInfoDigestBase64 = sha256Base64(keyInfoCanonical);

  // ── 7. Build SignedInfo ───────────────────────────────────────────────
  const signedInfoXml = [
    `<ds:SignedInfo xmlns:ds="${NS_DS}">`,
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:CanonicalizationMethod>`,
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>`,
    // Reference to the document content (enveloped signature)
    `<ds:Reference Id="${signatureId}-ref0" URI="">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform>`,
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>`,
    `<ds:DigestValue>${contentDigestBase64}</ds:DigestValue>`,
    `</ds:Reference>`,
    // Reference to KeyInfo
    `<ds:Reference URI="#${keyInfoId}">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>`,
    `<ds:DigestValue>${keyInfoDigestBase64}</ds:DigestValue>`,
    `</ds:Reference>`,
    // Reference to SignedProperties
    `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropertiesId}">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>`,
    `<ds:DigestValue>${signedPropsDigestBase64}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join("");

  // ── 8. Canonicalize SignedInfo and compute RSA-SHA256 signature ────────
  // Use Node.js native crypto for PKCS#1 v1.5 RSA-SHA256 — more reliable
  // than node-forge's sign() which can produce incorrect padding.
  // SignedInfo is a direct child of ds:Signature (ancestor declares ds: and xades:)
  const signedInfoCanonical = canonicalize(signedInfoXml, signatureAncestorNs);
  const signatureBuffer = crypto.sign(
    "sha256",
    Buffer.from(signedInfoCanonical, "utf8"),
    { key: keyPem, padding: crypto.constants.RSA_PKCS1_PADDING }
  );
  const signatureValueBase64 = signatureBuffer.toString("base64");

  // ── 9. Assemble the full ds:Signature element ────────────────────────
  // Note: In the final XML, the xmlns:ds on child elements is redundant
  // (inherited from ds:Signature), but the parser normalizes this.
  // When Hacienda extracts subsets for verification and applies C14N,
  // the namespace declarations are re-computed correctly.
  const signatureElement = [
    `<ds:Signature xmlns:ds="${NS_DS}" xmlns:xades="${NS_XADES}" Id="${signatureId}">`,
    signedInfoXml,
    `<ds:SignatureValue>${signatureValueBase64}</ds:SignatureValue>`,
    keyInfoXml,
    `<ds:Object>`,
    `<xades:QualifyingProperties xmlns:xades="${NS_XADES}" Target="#${signatureId}">`,
    signedPropertiesXml,
    `</xades:QualifyingProperties>`,
    `</ds:Object>`,
    `</ds:Signature>`,
  ].join("");

  // ── 10. Insert signature before closing root element tag ──────────────
  const closingTagMatch = xmlString.match(/<\/([^\s>]+)\s*>\s*$/);
  if (!closingTagMatch) {
    throw new Error(
      "Could not find closing root element tag in XML document."
    );
  }

  const closingTag = closingTagMatch[0];
  const insertionIndex = xmlString.lastIndexOf(closingTag);

  return xmlString.slice(0, insertionIndex) + signatureElement + closingTag;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  // C14N text content escaping: only &, <, >
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
