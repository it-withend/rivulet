import { NextResponse } from "next/server";
import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAnon } from "@/lib/db/client";
import { verifyCredential } from "@/lib/credentials/jwt";
import { CERTIFICATE, TIER_LABEL, certificateNumber, qrModules } from "@/lib/credentials/certificate-copy";

type CredentialShape = {
  name?: string;
  validFrom?: string;
  credentialSubject?: {
    name?: string;
    achievement?: { name?: string; description?: string };
  };
  evidence?: { description?: string }[];
};

// Rivulet's paper/ink palette (src/app/globals.css), as 0-1 RGB for pdf-lib.
const PAPER = rgb(0.933, 0.929, 0.898);
const INK = rgb(0.082, 0.106, 0.109);
const INK_MUTED = rgb(0.231, 0.271, 0.275);
const RULE = rgb(0.784, 0.776, 0.733);
const RIVER = rgb(0.094, 0.318, 0.341);
const AMBER = rgb(0.89, 0.71, 0.235);
const WHITE = rgb(1, 1, 1);

/** The standard PDF fonts only cover Latin-1 and a few punctuation marks; anything else would throw. */
function safe(text: string): string {
  return text.replace(/[^ -~ -ÿ–—‘’“”•…]/g, "?");
}

/** Word-wraps `text` to `maxWidth`; a single "word" longer than the whole
 * width (a URL, a long id) is hard-broken by character instead of being
 * left to overflow the page. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    let remaining = word;
    while (font.widthOfTextAtSize(remaining, size) > maxWidth) {
      let cut = remaining.length;
      while (cut > 1 && font.widthOfTextAtSize(remaining.slice(0, cut), size) > maxWidth) cut--;
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }
    const candidate = line ? `${line} ${remaining}` : remaining;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = remaining;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; width: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; lineHeight: number },
): number {
  const lines = wrap(text, opts.font, opts.size, opts.width);
  lines.forEach((line, i) => {
    page.drawText(line, { x: opts.x, y: opts.y - i * opts.lineHeight, size: opts.size, font: opts.font, color: opts.color });
  });
  return opts.y - lines.length * opts.lineHeight;
}

/** The Rivulet stream mark (the same drawing as src/app/icon.svg), placed with its top-left at (x, top). */
function drawMark(page: PDFPage, x: number, top: number, size: number, colour: ReturnType<typeof rgb>) {
  const s = size / 64;
  page.drawSvgPath("M17 15 C 35 13, 37 29, 27 33 S 26 51, 44 49", {
    x,
    y: top,
    scale: s,
    borderColor: colour,
    borderWidth: 6.5 * s,
    borderLineCap: LineCapStyle.Round,
  });
  page.drawEllipse({ x: x + 47 * s, y: top - 49 * s, xScale: 5.2 * s, yScale: 5.2 * s, color: AMBER });
  page.drawEllipse({ x: x + 17 * s, y: top - 15 * s, xScale: 3 * s, yScale: 3 * s, color: colour });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAnon();

  const { data: certificate, error } = await db
    .from("certificates")
    .select("id, tier, recipient_name, credential, jwt, issued_at, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !certificate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A revoked or tampered credential never becomes a nice-looking PDF —
  // that would be the one place this honesty rule matters most, since a
  // downloaded file gets passed around long after the web page is closed.
  if (certificate.revoked_at) {
    return new NextResponse("This certificate has been revoked and is no longer valid.", {
      status: 410,
      headers: { "content-type": "text/plain" },
    });
  }
  const verification = verifyCredential(certificate.jwt);
  if (verification.status === "invalid") {
    return new NextResponse(
      "This certificate's signature does not match its content and cannot be issued as a PDF.",
      { status: 422, headers: { "content-type": "text/plain" } },
    );
  }

  const credential = certificate.credential as CredentialShape;
  const achievement = credential.credentialSubject?.achievement;
  const evidence = credential.evidence?.[0]?.description ?? "";
  const tierLabel = TIER_LABEL[certificate.tier] ?? certificate.tier;
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rivulet-xi.vercel.app").replace(/\/$/, "");
  const verifyUrl = `${site}/certificates/${certificate.id}`;
  const verifyShort = verifyUrl.replace(/^https?:\/\//, "");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rivulet volunteer certificate — ${safe(certificate.recipient_name)}`);
  pdf.setSubject("Rivulet certificate of volunteering (citizen science)");
  pdf.setProducer("Rivulet");

  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 842;
  const H = 595;
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

  // --- Left band with the seal --------------------------------------------
  const bandWidth = 220;
  page.drawRectangle({ x: 0, y: 0, width: bandWidth, height: H, color: INK });

  const cx = bandWidth / 2;
  const cy = H - 215;
  page.drawEllipse({ x: cx, y: cy, xScale: 88, yScale: 88, borderColor: PAPER, borderWidth: 1.6 });
  page.drawEllipse({ x: cx, y: cy, xScale: 82, yScale: 82, borderColor: PAPER, borderWidth: 0.6 });
  // A ring of tick marks, like the milled edge of a seal.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    page.drawLine({
      start: { x: cx + Math.cos(a) * 70, y: cy + Math.sin(a) * 70 },
      end: { x: cx + Math.cos(a) * 77, y: cy + Math.sin(a) * 77 },
      thickness: 0.7,
      color: PAPER,
    });
  }
  page.drawEllipse({ x: cx, y: cy, xScale: 58, yScale: 58, borderColor: PAPER, borderWidth: 0.6 });
  drawMark(page, cx - 30, cy + 30, 60, PAPER);

  const sealLine1 = "CITIZEN SCIENCE";
  page.drawText(sealLine1, { x: cx - sansBold.widthOfTextAtSize(sealLine1, 8) / 2, y: cy - 118, size: 8, font: sansBold, color: PAPER });
  const sealLine2 = `VOLUNTEER · ${tierLabel.toUpperCase()}`;
  page.drawText(sealLine2, { x: cx - sans.widthOfTextAtSize(sealLine2, 7.5) / 2, y: cy - 131, size: 7.5, font: sans, color: RULE });

  page.drawText("CERTIFICATE NO.", { x: 30, y: 62, size: 7, font: sans, color: RULE });
  page.drawText(certificateNumber(certificate.id), { x: 30, y: 48, size: 12, font: sansBold, color: PAPER });
  page.drawText("rivulet-xi.vercel.app", { x: 30, y: 24, size: 8, font: sans, color: RULE });

  // --- Right area ----------------------------------------------------------
  const wmCx = 720;
  const wmCy = 260;
  for (let r = 40; r <= 220; r += 30) {
    page.drawEllipse({ x: wmCx, y: wmCy, xScale: r, yScale: r * 0.82, borderColor: RULE, borderWidth: 0.6, borderOpacity: 0.35 });
  }

  const contentX = bandWidth + 40;
  const contentRight = W - 40;
  const contentWidth = contentRight - contentX;

  // Header: mark, wordmark, issue date.
  page.drawRectangle({ x: contentX, y: H - 66, width: 30, height: 30, color: RIVER });
  drawMark(page, contentX + 3, H - 36 - 3 + 0, 24, PAPER);
  page.drawText("Rivulet", { x: contentX + 38, y: H - 58, size: 22, font: serifItalic, color: RIVER });
  const dateLabel = `Issued ${issuedDate}`;
  page.drawText(dateLabel, { x: contentRight - sans.widthOfTextAtSize(dateLabel, 10), y: H - 52, size: 10, font: sans, color: INK_MUTED });

  page.drawText(CERTIFICATE.title.toUpperCase(), { x: contentX, y: H - 100, size: 10, font: sansBold, color: RIVER });
  page.drawText(CERTIFICATE.intro, { x: contentX, y: H - 118, size: 11, font: sans, color: INK_MUTED });
  page.drawText(safe(certificate.recipient_name), { x: contentX, y: H - 152, size: 34, font: serifBold, color: INK });

  let cursorY = drawParagraph(page, CERTIFICATE.body, {
    x: contentX,
    y: H - 176,
    width: contentWidth - 20,
    size: 11,
    font: sans,
    color: INK,
    lineHeight: 15,
  });

  page.drawText("Volunteer level", { x: contentX, y: cursorY - 16, size: 9.5, font: sans, color: INK_MUTED });
  page.drawText(safe(achievement?.name ?? "Rivulet Contributor"), { x: contentX, y: cursorY - 38, size: 19, font: serifBold, color: RIVER });
  cursorY -= 38;
  if (evidence) {
    drawParagraph(page, evidence, { x: contentX, y: cursorY - 18, width: contentWidth, size: 9.5, font: sans, color: INK_MUTED, lineHeight: 13 });
  }

  // Signature block: the signatory's typed signature over a rule, then name and role.
  const sigX = contentX;
  const sigLineY = 122;
  page.drawText(CERTIFICATE.signatory.name, { x: sigX + 4, y: sigLineY + 8, size: 30, font: serifItalic, color: INK, rotate: degrees(3) });
  page.drawLine({ start: { x: sigX, y: sigLineY }, end: { x: sigX + 190, y: sigLineY }, thickness: 0.75, color: INK });
  page.drawText(`${CERTIFICATE.signatory.name}, ${CERTIFICATE.signatory.title}`, { x: sigX, y: sigLineY - 14, size: 10.5, font: sansBold, color: INK });
  const signatureLine =
    verification.status === "verified" ? "Digitally signed · Ed25519 · verified" : "Cannot verify on this deployment";
  page.drawText(signatureLine, { x: sigX, y: sigLineY - 27, size: 8.5, font: sans, color: INK_MUTED });

  // QR code and verification address, bottom right.
  const modules = qrModules(verifyUrl);
  const qrSize = 78;
  const quiet = 3;
  const cell = qrSize / (modules.length + quiet * 2);
  const qrX = contentRight - qrSize;
  const qrY = 78;
  page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, color: WHITE });
  modules.forEach((row, y) =>
    row.forEach((on, x) => {
      if (!on) return;
      page.drawRectangle({
        x: qrX + (x + quiet) * cell,
        y: qrY + qrSize - (y + quiet + 1) * cell,
        width: cell + 0.1,
        height: cell + 0.1,
        color: INK,
      });
    }),
  );
  page.drawText("Scan or visit to verify:", { x: qrX - 150, y: qrY + 60, size: 8, font: sans, color: INK_MUTED });
  wrap(verifyShort, sansBold, 8, 140).forEach((line, i) => {
    page.drawText(line, { x: qrX - 150, y: qrY + 48 - i * 10, size: 8, font: sansBold, color: RIVER });
  });

  // Disclaimer across the foot.
  drawParagraph(page, CERTIFICATE.disclaimer, {
    x: contentX,
    y: 52,
    width: contentWidth,
    size: 7.2,
    font: sans,
    color: INK_MUTED,
    lineHeight: 9.5,
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="rivulet-volunteer-${certificate.tier}-${certificate.recipient_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
