import { NextResponse } from "next/server";
import { google } from "googleapis";
import { appendJournalEntryServer } from "@/lib/journal-server";

/** Nom des colonnes reconnus (minuscules, pour matching). */
const HEADER_ALIASES: Record<string, string[]> = {
  pseudo: ["pseudo"],
  entreprise: ["entreprise"],
  prenom: ["prénom", "prenom"],
  nom: ["nom"],
  idDiscord: ["id discord", "discord"],
  email: ["email", "e-mail"],
  pays: ["pays"],
  ville: ["ville"],
  region: ["region", "region/etat", "région", "region/état"],
  langues: ["langue(s) parlée(s)", "langues parlées", "langues"],
  ndaSignee: ["nda signée", "nda signee", "nda"],
  referent: ["referent", "réferent", "référent"],
  notes: ["notes"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon"],
  lock: ["lock"],
  contacter: [
    "contacter",
    "contacter ?",
    "à contacter",
    "a contacter",
    "ok pour contact",
    "contact ok",
    "contact ok ?",
    "contacté",
    "contacté ?",
    "contacte",
    "deja contacté",
    "déjà contacté",
    "déja contacté",
  ],
  twitter: ["twitter"],
  instagram: ["instagram"],
  tiktok: ["tiktok"],
  youtube: ["youtube"],
  linkedin: ["linkedin"],
  twitch: ["twitch"],
  autre: ["autre"],
};

function getHeaderIndices(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, " ");
    out[key] = i;
  });
  return out;
}

function findColumnIndex(
  indices: Record<string, number>,
  keys: string[]
): number {
  for (const k of keys) {
    if (indices[k] !== undefined) return indices[k];
  }
  return -1;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      memberId,
      pseudo = "",
      entreprise = "",
      prenom = "",
      nom = "",
      pays = "",
      ville = "",
      region = "",
      idDiscord = "",
      email = "",
      langues = "",
      ndaSignee = "",
      referent = "",
      notes = "",
      latitude = "",
      longitude = "",
      lock = "",
      contacter = "",
      twitter = "",
      instagram = "",
      tiktok = "",
      youtube = "",
      linkedin = "",
      twitch = "",
      autre = "",
      contactType = "communication",
    }: {
      memberId: string;
      pseudo?: string;
      entreprise?: string;
      prenom?: string;
      nom?: string;
      pays?: string;
      ville?: string;
      region?: string;
      idDiscord?: string;
      email?: string;
      langues?: string;
      ndaSignee?: string;
      referent?: string;
      notes?: string;
      latitude?: string;
      longitude?: string;
      lock?: string;
      contacter?: string;
      twitter?: string;
      instagram?: string;
      tiktok?: string;
      youtube?: string;
      linkedin?: string;
      twitch?: string;
      autre?: string;
      contactType?: "communication" | "commercial";
    } = body;

    if (!memberId || typeof memberId !== "string" || !memberId.startsWith("sheet-")) {
      return NextResponse.json(
        { error: "memberId invalide (attendu: sheet-{index})" },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
    const rangeA1 = contactType === "commercial"
      ? (process.env.GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000")
      : (process.env.GOOGLE_SHEETS_RANGE ?? "Tableau!A1:Z1000");

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "GOOGLE_SHEETS_SPREADSHEET_ID non configuré" },
        { status: 500 }
      );
    }

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      return NextResponse.json(
        {
          error:
            "Écriture non configurée. Ajoutez GOOGLE_SERVICE_ACCOUNT_KEY (JSON du compte de service) et partagez le tableur avec l’email du compte.",
        },
        { status: 503 }
      );
    }

    let credentials: object;
    try {
      credentials = JSON.parse(serviceAccountKey) as object;
    } catch {
      return NextResponse.json(
        { error: "GOOGLE_SERVICE_ACCOUNT_KEY : JSON invalide" },
        { status: 500 }
      );
    }

    const rowIndex = parseInt(memberId.replace(/^sheet-/, ""), 10);
    if (Number.isNaN(rowIndex) || rowIndex < 0) {
      return NextResponse.json(
        { error: "memberId invalide (index attendu)" },
        { status: 400 }
      );
    }

    const sheetRowNum = rowIndex + 2;
    const match = rangeA1.match(/^([^!]+)!/);
    const sheetName = match ? match[1].replace(/^'|'$/g, "") : "Feuille 1";

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const headerRange = `${sheetName}!A1:Z1`;
    const rowRange = `${sheetName}!A${sheetRowNum}:Z${sheetRowNum}`;

    const [headerRes, rowRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: headerRange,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rowRange,
      }),
    ]);

    const headerRow = headerRes.data.values?.[0] ?? [];
    const currentRow = (rowRes.data.values?.[0] ?? []) as string[];
    const indices = getHeaderIndices(headerRow);

    const pseudoCol = findColumnIndex(indices, HEADER_ALIASES.pseudo);
    const entrepriseCol = findColumnIndex(indices, HEADER_ALIASES.entreprise);
    const prenomCol = findColumnIndex(indices, HEADER_ALIASES.prenom);
    const nomCol = findColumnIndex(indices, HEADER_ALIASES.nom);
    const idDiscordCol = findColumnIndex(indices, HEADER_ALIASES.idDiscord);
    const emailCol = findColumnIndex(indices, HEADER_ALIASES.email);
    const paysCol = findColumnIndex(indices, HEADER_ALIASES.pays);
    const villeCol = findColumnIndex(indices, HEADER_ALIASES.ville);
    const regionCol = findColumnIndex(indices, HEADER_ALIASES.region);
    const languesCol = findColumnIndex(indices, HEADER_ALIASES.langues);
    const ndaSigneeCol = findColumnIndex(indices, HEADER_ALIASES.ndaSignee);
    const referentCol = findColumnIndex(indices, HEADER_ALIASES.referent);
    const notesCol = findColumnIndex(indices, HEADER_ALIASES.notes);
    const latitudeCol = findColumnIndex(indices, HEADER_ALIASES.latitude);
    const longitudeCol = findColumnIndex(indices, HEADER_ALIASES.longitude);
    const lockCol = findColumnIndex(indices, HEADER_ALIASES.lock);
    const contacterCol = findColumnIndex(indices, HEADER_ALIASES.contacter);
    const twitterCol = findColumnIndex(indices, HEADER_ALIASES.twitter);
    const instagramCol = findColumnIndex(indices, HEADER_ALIASES.instagram);
    const tiktokCol = findColumnIndex(indices, HEADER_ALIASES.tiktok);
    const youtubeCol = findColumnIndex(indices, HEADER_ALIASES.youtube);
    const linkedinCol = findColumnIndex(indices, HEADER_ALIASES.linkedin);
    const twitchCol = findColumnIndex(indices, HEADER_ALIASES.twitch);
    const autreCol = findColumnIndex(indices, HEADER_ALIASES.autre);

    const newRow = [...currentRow];
    while (newRow.length < headerRow.length) newRow.push("");

    if (pseudoCol >= 0) newRow[pseudoCol] = String(pseudo ?? "").trim();
    if (entrepriseCol >= 0) newRow[entrepriseCol] = String(entreprise ?? "").trim();
    if (prenomCol >= 0) newRow[prenomCol] = String(prenom ?? "").trim();
    if (nomCol >= 0) newRow[nomCol] = String(nom ?? "").trim();
    if (idDiscordCol >= 0) newRow[idDiscordCol] = String(idDiscord ?? "").trim();
    if (emailCol >= 0) newRow[emailCol] = String(email ?? "").trim();
    if (paysCol >= 0) newRow[paysCol] = String(pays ?? "").trim();
    if (villeCol >= 0) newRow[villeCol] = String(ville ?? "").trim();
    if (regionCol >= 0) newRow[regionCol] = String(region ?? "").trim();
    if (languesCol >= 0) newRow[languesCol] = String(langues ?? "").trim();
    if (ndaSigneeCol >= 0) newRow[ndaSigneeCol] = String(ndaSignee ?? "").trim();
    if (referentCol >= 0) newRow[referentCol] = String(referent ?? "").trim();
    if (notesCol >= 0) newRow[notesCol] = String(notes ?? "").trim();
    if (latitudeCol >= 0) newRow[latitudeCol] = String(latitude ?? "").trim();
    if (longitudeCol >= 0) newRow[longitudeCol] = String(longitude ?? "").trim();
    if (lockCol >= 0) newRow[lockCol] = String(lock ?? "").trim();
    if (contacterCol >= 0)
      newRow[contacterCol] = String(contacter ?? "").trim();
    if (twitterCol >= 0) newRow[twitterCol] = String(twitter ?? "").trim();
    if (instagramCol >= 0) newRow[instagramCol] = String(instagram ?? "").trim();
    if (tiktokCol >= 0) newRow[tiktokCol] = String(tiktok ?? "").trim();
    if (youtubeCol >= 0) newRow[youtubeCol] = String(youtube ?? "").trim();
    if (linkedinCol >= 0) newRow[linkedinCol] = String(linkedin ?? "").trim();
    if (twitchCol >= 0) newRow[twitchCol] = String(twitch ?? "").trim();
    if (autreCol >= 0) newRow[autreCol] = String(autre ?? "").trim();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rowRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newRow],
      },
    });

    await appendJournalEntryServer(sheets, spreadsheetId, "Modifié", contactType, {
      memberId,
      pseudo: pseudo || [prenom, nom].filter(Boolean).join(" ").trim() || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("sheets/update error:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
