import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * Vérifie le mot de passe contre la valeur stockée dans le Google Sheet.
 * GOOGLE_SHEET_PASS = MDP!A1:B2 → le mot de passe est en A1.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";

    const spreadsheetId =
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
      process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
    const rangeConfig = process.env.GOOGLE_SHEET_PASS ?? "MDP!A1:B2";
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, error: "Configuration tableur manquante" },
        { status: 500 }
      );
    }

    if (!serviceAccountKey) {
      return NextResponse.json(
        { ok: false, error: "Configuration compte de service manquante" },
        { status: 500 }
      );
    }

    // Plage configurée (ex: MDP!A1:B2) ; le mot de passe est en A1 = values[0][0]
    const match = (rangeConfig.trim() || "MDP!A1:B2").match(/^'?([^'!]+)'?\s*!/i);
    const sheetName = match ? match[1].trim() : "MDP";

    let credentials: object;
    try {
      credentials = JSON.parse(serviceAccountKey) as object;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Clé de service invalide" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const rangesToTry = [
      `${sheetName}!A1:A1`,
      `'${sheetName}'!A1:A1`,
    ];

    let res: { data: { values?: unknown[][] } } | null = null;
    let lastErr: unknown = null;

    for (const range of rangesToTry) {
      try {
        res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!res) {
      const err = lastErr as { message?: string; code?: number } | undefined;
      const msg = err?.message ?? "";
      if (msg.includes("Unable to parse range") || msg.includes("INVALID_ARGUMENT") || err?.code === 400) {
        return NextResponse.json(
          {
            ok: false,
            error: `Feuille « ${sheetName} » introuvable. Créez une feuille nommée exactement « ${sheetName} » dans le tableur, avec le mot de passe en cellule A1.`,
          },
          { status: 400 }
        );
      }
      throw lastErr;
    }

    const values = res.data.values ?? [];
    const storedPassword = (values[0]?.[0] ?? "").toString().trim();

    if (!storedPassword) {
      return NextResponse.json(
        { ok: false, error: "Aucun mot de passe configuré dans le sheet" },
        { status: 500 }
      );
    }

    const ok = password.trim() === storedPassword;
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[check-password]", e);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
