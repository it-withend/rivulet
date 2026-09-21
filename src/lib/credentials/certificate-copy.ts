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

/**
 * A drawn signature, as vector strokes in a 240 x 90 box, so the page and the
 * PDF show the same mark. This one is a test signature; replace the paths with
 * the signatory's own (an SVG of their real signature) before real use.
 */
export const SIGNATURE = {
  width: 240,
  height: 90,
  strokes: [
    {
      width: 2.5,
      d: "M10 68 C 20 46, 31 8, 45 11 C 56 14, 47 52, 41 67 C 46 50, 60 42, 67 47 C 72 52, 63 64, 60 56 C 59 44, 80 32, 88 43 C 92 50, 85 61, 82 53 C 83 40, 98 28, 105 40 C 108 48, 101 58, 99 51 C 101 38, 114 33, 121 43 C 124 50, 117 60, 114 53 C 116 40, 134 29, 145 37 C 152 43, 144 56, 140 48 C 140 36, 156 22, 165 12 C 168 8, 170 14, 167 22 C 163 34, 158 52, 172 50 C 184 48, 196 38, 226 30",
    },
    { width: 2, d: "M150 26 C 166 22, 182 26, 200 20" },
    { width: 1.7, d: "M22 76 C 80 82, 152 78, 218 64" },
  ],
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
