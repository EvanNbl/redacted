import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId }: { memberId: string } = body;

    if (!memberId || typeof memberId !== "string" || !memberId.startsWith("sheet-")) {
      return NextResponse.json(
        { error: "memberId invalide (attendu: sheet-{index})" },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
    const rangeA1 = process.env.GOOGLE_SHEETS_RANGE ?? process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Contacts!A1:Z1000";

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
            "Écriture non configurée. Ajoutez GOOGLE_SERVICE_ACCOUNT_KEY (JSON du compte de service) et partagez le tableur avec l'email du compte.",
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

    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    if (!sheet?.properties?.sheetId) {
      return NextResponse.json(
        { error: `Feuille "${sheetName}" introuvable.` },
        { status: 404 }
      );
    }

    // Delete row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: sheetRowNum - 1,
                endIndex: sheetRowNum,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("sheets/delete error:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
