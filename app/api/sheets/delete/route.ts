import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, contactType = "communication" }: { memberId: string; contactType?: "communication" | "commercial" } = body;

    if (!memberId || typeof memberId !== "string" || !memberId.startsWith("sheet-")) {
      return NextResponse.json(
        { error: "memberId invalide (attendu: sheet-{index})" },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
    const rangeA1 = contactType === "commercial"
      ? (process.env.GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000")
      : (process.env.GOOGLE_SHEETS_RANGE ?? "Communication!A1:Z1000");

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

    const sheetRowNum = rowIndex + 2; // rowIndex 0 = ligne 2 dans le sheet (après l'en-tête)
    const match = rangeA1.match(/^([^!]+)!/);
    const sheetName = match ? match[1].replace(/^'|'$/g, "") : (contactType === "commercial" ? "Commercial" : "Communication");

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
    
    // Normalize sheet name for comparison (trim and lowercase)
    const normalizedSheetName = sheetName.trim().toLowerCase();
    
    // Debug: log all sheet names
    const availableSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    console.log(`[DELETE] Recherche de la feuille "${sheetName}" (normalisé: "${normalizedSheetName}") parmi:`, availableSheets);
    console.log(`[DELETE] contactType:`, contactType, `rangeA1:`, rangeA1);
    console.log(`[DELETE] rowIndex:`, rowIndex, `sheetRowNum:`, sheetRowNum);
    
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title?.trim().toLowerCase() === normalizedSheetName
    );
    if (!sheet?.properties?.sheetId) {
      return NextResponse.json(
        { 
          error: `Feuille "${sheetName}" introuvable. Feuilles disponibles: ${availableSheets.join(", ")}` 
        },
        { status: 404 }
      );
    }

    // Vérifier que la ligne existe avant de la supprimer
    try {
      // D'abord, obtenir le nombre total de lignes dans la feuille
      const allDataRange = `${sheetName}!A:Z`;
      const allDataCheck = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: allDataRange,
      });
      
      const allRows = allDataCheck.data.values || [];
      const totalRows = allRows.length;
      
      console.log(`[DELETE] Feuille "${sheetName}" contient ${totalRows} lignes au total`);
      
      if (sheetRowNum > totalRows) {
        return NextResponse.json(
          { error: `La ligne ${sheetRowNum} n'existe pas. La feuille "${sheetName}" ne contient que ${totalRows} lignes.` },
          { status: 400 }
        );
      }
      
      // Vérifier que la ligne spécifique contient des données
      const rowData = allRows[rowIndex + 1]; // +1 car allRows[0] est l'en-tête
      if (!rowData || rowData.length === 0 || rowData.every(cell => !cell || String(cell).trim() === "")) {
        return NextResponse.json(
          { error: `La ligne ${sheetRowNum} est vide dans la feuille "${sheetName}"` },
          { status: 404 }
        );
      }
      
      // Vérifier s'il ne reste qu'une seule ligne de données (en plus de l'en-tête)
      const dataRowsCount = totalRows - 1; // Exclure l'en-tête
      const isLastDataRow = dataRowsCount === 1 && sheetRowNum === 2;
      
      if (isLastDataRow) {
        console.log(`[DELETE] Dernière ligne de données détectée. Vidage de la ligne au lieu de la supprimer.`);
        
        // Au lieu de supprimer, vider la ligne pour éviter l'erreur Google Sheets
        // qui empêche de supprimer toutes les lignes non gelées
        const rowRange = `${sheetName}!A${sheetRowNum}:Z${sheetRowNum}`;
        // Obtenir le nombre de colonnes de l'en-tête pour créer une ligne vide de la bonne taille
        const headerRow = allRows[0] || [];
        const emptyRow = Array(Math.max(headerRow.length, rowData.length)).fill("");
        
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: rowRange,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [emptyRow],
          },
        });
        
        return NextResponse.json({ ok: true, message: "Dernière ligne vidée (non supprimée pour éviter l'erreur Google Sheets)" });
      }
      
      console.log(`[DELETE] Ligne trouvée, suppression de la ligne ${sheetRowNum} (index ${rowIndex})`);
    } catch (checkError) {
      console.error("[DELETE] Erreur lors de la vérification de la ligne:", checkError);
      return NextResponse.json(
        { error: `Impossible de vérifier l'existence de la ligne ${sheetRowNum}: ${checkError instanceof Error ? checkError.message : "Erreur inconnue"}` },
        { status: 500 }
      );
    }

    // Delete row using batchUpdate
    // Note: startIndex et endIndex sont basés sur l'index 0 de Google Sheets
    // La ligne 1 (en-tête) = index 0, ligne 2 (première donnée) = index 1, etc.
    const startIndex = sheetRowNum - 1; // Convertir le numéro de ligne (1-based) en index (0-based)
    const endIndex = sheetRowNum; // endIndex est exclusif
    
    console.log(`[DELETE] Suppression: startIndex=${startIndex}, endIndex=${endIndex}`);
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex,
                endIndex,
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
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("sheets/delete error details:", {
      message,
      stack,
      error: e,
    });
    return NextResponse.json(
      { 
        error: message,
        details: process.env.NODE_ENV === "development" ? stack : undefined
      },
      { status: 500 }
    );
  }
}
