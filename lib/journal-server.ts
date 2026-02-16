/**
 * Écriture du Journal côté serveur (routes API).
 * Utilise le même client Google Sheets que les routes append/update/delete.
 */

import type { sheets_v4 } from "googleapis";

const JOURNAL_SHEET_NAME =
  (process.env.GOOGLE_SHEETS_JOURNAL_RANGE ??
   process.env.NEXT_PUBLIC_GOOGLE_SHEETS_JOURNAL_RANGE ??
   "Journal!A1:G1000").match(/^([^!]+)!/)?.[1]?.replace(/^'|'$/g, "") ?? "Journal";

export type JournalAction = "Ajouté" | "Modifié" | "Supprimé";

export async function appendJournalEntryServer(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  action: JournalAction,
  contactType: string,
  options: { memberId?: string; pseudo?: string; details?: string }
): Promise<void> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR");
  const timeStr = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const row = [
    dateStr,
    timeStr,
    action,
    contactType,
    options.memberId ?? "",
    options.pseudo ?? "",
    options.details ?? "",
  ];

  try {
    const range = `${JOURNAL_SHEET_NAME}!A:G`;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    console.log("[Journal API] Entrée écrite:", action, contactType, options.pseudo ?? options.memberId);
  } catch (e) {
    console.warn("[Journal API] Écriture échouée (feuille peut-être absente):", e);
  }
}
