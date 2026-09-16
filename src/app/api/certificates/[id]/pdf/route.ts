import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAnon } from "@/lib/db/client";
import { verifyCredential } from "@/lib/credentials/jwt";

const TIER_LABEL: Record<string, string> = {
  contributor: "Contributor",
  data_steward: "Data Steward",
};

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

/** Word-wraps `text` to `maxWidth`; a single "word" longer than the whole
 * width (a URL, a long id) is hard-broken by character instead of being
 * left to overflow the page. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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
  opts: {
    x: number;
    y: number;
    width: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    lineHeight: number;
  },
): number {
  const lines = wrap(text, opts.font, opts.size, opts.width);
  lines.forEach((line, i) => {
    page.drawText(line, {
      x: opts.x,
      y: opts.y - i * opts.lineHeight,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
  });
  return opts.y - lines.length * opts.lineHeight;
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
  // Shown without the protocol so it reads as a short, plain address, the
  // way Coursera's own "Verify this certificate at:" line does.
  const verifySite = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rivulet-xi.vercel.app").replace(
    /^https?:\/\//,
    "",
  );
  const verifyUrl = `${verifySite}/certificates/${certificate.id}`;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rivulet ${tierLabel} certificate — ${certificate.recipient_name}`);
  pdf.setSubject("Rivulet citizen-science certificate");
  pdf.setProducer("Rivulet");

  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 842;
  const H = 595;
  const page = pdf.addPage([W, H]);

  // Ground.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

  // --- Left band -----------------------------------------------------
  const bandWidth = 220;
  page.drawRectangle({ x: 0, y: 0, width: bandWidth, height: H, color: INK });

  const sealCx = bandWidth / 2;
  const sealCy = H - 230;
  page.drawEllipse({ x: sealCx, y: sealCy, xScale: 78, yScale: 78, borderColor: PAPER, borderWidth: 1.5 });
  page.drawEllipse({ x: sealCx, y: sealCy, xScale: 66, yScale: 66, borderColor: PAPER, borderWidth: 0.75 });
  const sealTitle = "RIVULET";
  page.drawText(sealTitle, {
    x: sealCx - serifBold.widthOfTextAtSize(sealTitle, 15) / 2,
    y: sealCy + 10,
    size: 15,
    font: serifBold,
    color: PAPER,
  });
  const sealSub = "CITIZEN SCIENCE";
  page.drawText(sealSub, {
    x: sealCx - sans.widthOfTextAtSize(sealSub, 7) / 2,
    y: sealCy - 8,
    size: 7,
    font: sans,
    color: PAPER,
  });
  const sealTier = tierLabel.toUpperCase();
  page.drawText(sealTier, {
    x: sealCx - sansBold.widthOfTextAtSize(sealTier, 8) / 2,
    y: sealCy - 22,
    size: 8,
    font: sansBold,
    color: RULE,
  });

  // Stat badge, echoing a course-count ribbon.
  const badgeY = H - 350;
  page.drawRectangle({ x: 30, y: badgeY, width: bandWidth - 60, height: 30, color: INK_MUTED });
  const statText = `${achievement?.name ?? "Rivulet certificate"}`.toUpperCase();
  const statLines = wrap(statText, sansBold, 9, bandWidth - 76);
  statLines.slice(0, 2).forEach((line, i) => {
    page.drawText(line, {
      x: 38,
      y: badgeY + 19 - i * 11,
      size: 9,
      font: sansBold,
      color: PAPER,
    });
  });

  if (achievement?.description) {
    drawParagraph(page, achievement.description, {
      x: 30,
      y: badgeY - 20,
      width: bandWidth - 60,
      size: 8.5,
      font: sans,
      color: RULE,
      lineHeight: 11.5,
    });
  }

  page.drawText("rivulet-xi.vercel.app", { x: 30, y: 22, size: 8, font: sans, color: RULE });

  // --- Right area: faint watermark rings ------------------------------
  const wmCx = 720;
  const wmCy = 260;
  for (let r = 40; r <= 220; r += 30) {
    page.drawEllipse({
      x: wmCx,
      y: wmCy,
      xScale: r,
      yScale: r * 0.82,
      borderColor: RULE,
      borderWidth: 0.6,
      borderOpacity: 0.35,
    });
  }

  const contentX = bandWidth + 40;
  const contentRight = W - 40;
  const contentWidth = contentRight - contentX;

  page.drawText("Rivulet", { x: contentX, y: H - 55, size: 24, font: serifItalic, color: RIVER });
  page.drawText("URBAN STREAMS", { x: contentX + 78, y: H - 50, size: 8, font: sans, color: INK_MUTED });

  const dateLabel = `Issued ${issuedDate}`;
  page.drawText(dateLabel, {
    x: contentRight - sans.widthOfTextAtSize(dateLabel, 10),
    y: H - 50,
    size: 10,
    font: sans,
    color: INK_MUTED,
  });

  page.drawText(certificate.recipient_name, { x: contentX, y: H - 105, size: 34, font: serifBold, color: INK });

  page.drawText("has demonstrated stream reporting recognised by Rivulet as a", {
    x: contentX,
    y: H - 132,
    size: 11,
    font: sans,
    color: INK_MUTED,
  });

  page.drawText(achievement?.name ?? "Rivulet certificate", {
    x: contentX,
    y: H - 158,
    size: 20,
    font: serifBold,
    color: RIVER,
  });

  let cursorY = H - 185;
  if (achievement?.description) {
    cursorY = drawParagraph(page, achievement.description, {
      x: contentX,
      y: cursorY,
      width: contentWidth,
      size: 10.5,
      font: sans,
      color: INK,
      lineHeight: 15,
    });
  }
  if (evidence) {
    drawParagraph(page, evidence, {
      x: contentX,
      y: cursorY - 12,
      width: contentWidth,
      size: 9.5,
      font: sans,
      color: INK_MUTED,
      lineHeight: 13,
    });
  }

  // Signature block.
  const sigX = contentRight - 210;
  const sigLineY = 118;
  page.drawLine({ start: { x: sigX, y: sigLineY }, end: { x: contentRight, y: sigLineY }, thickness: 0.75, color: INK });
  page.drawText("Rivulet Issuer", { x: sigX, y: sigLineY + 6, size: 11, font: sansBold, color: INK });
  page.drawText("Automated verification, Ed25519", { x: sigX, y: sigLineY - 12, size: 8.5, font: sans, color: INK_MUTED });
  const signatureLine =
    verification.status === "verified" ? "Signature verified" : "Cannot verify on this deployment";
  page.drawText(signatureLine, { x: sigX, y: sigLineY - 24, size: 8.5, font: sans, color: INK_MUTED });

  // Disclaimer, bottom-left of the right area.
  const disclaimer =
    "Rivulet is an independent citizen-science prototype built for the IEEE OneAquaHealth Global " +
    "Hackathon 2026. This certificate carries no institutional endorsement and is not issued by, " +
    "or on behalf of, the EU, IEEE or the OneAquaHealth consortium.";
  drawParagraph(page, disclaimer, {
    x: contentX,
    y: 68,
    width: contentWidth - 220,
    size: 7.5,
    font: sans,
    color: INK_MUTED,
    lineHeight: 10,
  });

  page.drawText("Verify this certificate at:", {
    x: contentRight - 210,
    y: 68,
    size: 8,
    font: sans,
    color: INK_MUTED,
  });
  const verifyLines = wrap(verifyUrl, sansBold, 8.5, 210);
  verifyLines.forEach((line, i) => {
    page.drawText(line, { x: contentRight - 210, y: 56 - i * 11, size: 8.5, font: sansBold, color: RIVER });
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="rivulet-${certificate.tier}-${certificate.recipient_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
