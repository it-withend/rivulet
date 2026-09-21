import QRCode from "qrcode";

/**
 * Wording and identity shared by the certificate page and its PDF, so the two
 * never drift apart. The signatory is a person at Rivulet, not an institution:
 * the certificate's weight comes from its verifiable signature, not from a
 * borrowed authority.
 */
export const CERTIFICATE = {
  title: "Certificate of Volunteering",
  subtitle: "Citizen science · Urban streams",
  intro: "This certifies that",
  body: "has volunteered as a citizen scientist with Rivulet, helping to monitor the health of urban streams by reporting what they see, smell and photograph at the water.",
  signatory: { name: "Azamat", title: "Founder & CEO", organisation: "Rivulet" },
  sealRing: "RIVULET · CITIZEN SCIENCE · VOLUNTEER · ",
  disclaimer:
    "Rivulet is an independent citizen-science prototype built for the IEEE OneAquaHealth Global Hackathon 2026. This certificate is issued and signed by Rivulet. It is not endorsed by, issued by, or issued on behalf of the EU, IEEE or the OneAquaHealth consortium.",
} as const;

export const TIER_LABEL: Record<string, string> = {
  contributor: "Contributor",
  data_steward: "Data Steward",
};

/** A short, readable certificate number taken from the id. */
export function certificateNumber(id: string): string {
  return `RV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The QR code's modules as rows of booleans, for drawing as SVG or PDF rectangles. */
export function qrModules(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const rows: boolean[][] = [];
  for (let y = 0; y < modules.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < modules.size; x++) row.push(Boolean(modules.data[y * modules.size + x]));
    rows.push(row);
  }
  return rows;
}
