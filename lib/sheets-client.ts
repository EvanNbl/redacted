/**
 * Client-side Google Sheets API handler.
 * Uses JWT auth with service account credentials to read/write directly
 * from the browser, bypassing the need for Next.js API routes.
 * Required for production builds with `output: "export"` (static).
 */

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

let tokenCache: { token: string; expiresAt: number } | null = null;

/* ── Helpers ─────────────────────────────────────────────── */

function base64url(input: string | ArrayBuffer): string {
  let b64: string;
  if (typeof input === "string") {
    b64 = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseServiceAccountKey(): ServiceAccountCredentials | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountCredentials;
  } catch {
    console.error("Invalid NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY JSON");
    return null;
  }
}

/* ── JWT / OAuth ─────────────────────────────────────────── */

async function createJWT(creds: ServiceAccountCredentials): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: creds.client_email,
    scope: SCOPES,
    aud: creds.token_uri || TOKEN_URI,
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const unsigned = `${headerB64}.${claimsB64}`;

  const pemBody = creds.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\r\n\s]/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken(
  creds: ServiceAccountCredentials
): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const jwt = await createJWT(creds);
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échange de token échoué : ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/* ── Column matching (same logic as server-side routes) ── */

const HEADER_ALIASES: Record<string, string[]> = {
  pseudo: ["pseudo"],
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
};

function getHeaderIndices(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    out[h.trim().toLowerCase().replace(/\s+/g, " ")] = i;
  });
  return out;
}

function findColumnIndex(
  indices: Record<string, number>,
  keys: string[]
): number {
  for (const k of keys) if (indices[k] !== undefined) return indices[k];
  return -1;
}

/* ── Public API ──────────────────────────────────────────── */

export function isClientSheetsAvailable(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY;
}

export interface SheetsMemberData {
  pseudo?: string;
  prenom?: string;
  nom?: string;
  idDiscord?: string;
  email?: string;
  pays?: string;
  ville?: string;
  region?: string;
  langues?: string;
  ndaSignee?: string;
  referent?: string;
  notes?: string;
  latitude?: string;
  longitude?: string;
}

function buildRow(
  headerRow: string[],
  data: SheetsMemberData,
  base?: string[]
): string[] {
  const indices = getHeaderIndices(headerRow);
  const row = base ? [...base] : Array(headerRow.length).fill("");
  while (row.length < headerRow.length) row.push("");

  const map: Record<string, string | undefined> = {
    pseudo: data.pseudo,
    prenom: data.prenom,
    nom: data.nom,
    idDiscord: data.idDiscord,
    email: data.email,
    pays: data.pays,
    ville: data.ville,
    region: data.region,
    langues: data.langues,
    ndaSignee: data.ndaSignee,
    referent: data.referent,
    notes: data.notes,
    latitude: data.latitude,
    longitude: data.longitude,
  };

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const col = findColumnIndex(indices, aliases);
    if (col >= 0 && map[field] !== undefined) {
      row[col] = String(map[field] ?? "").trim();
    }
  }
  return row;
}

export async function appendRowToSheet(
  data: SheetsMemberData,
  contactType: "communication" | "commercial" = "communication"
): Promise<{ ok: boolean; error?: string }> {
  const creds = parseServiceAccountKey();
  if (!creds)
    return {
      ok: false,
      error:
        "Clé du compte de service non configurée (NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY).",
    };

  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
  const rangeA1 = contactType === "commercial"
    ? (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000")
    : (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Communication!A1:Z1000");
  if (!spreadsheetId)
    return { ok: false, error: "ID du tableur non configuré." };

  try {
    const token = await getAccessToken(creds);
    const sheetName = (rangeA1.match(/^([^!]+)!/)?.[1] ?? (contactType === "commercial" ? "Commercial" : "Communication")).replace(
      /^'|'$/g,
      ""
    );

    // Read headers
    const hdrRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:Z1`)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!hdrRes.ok)
      throw new Error(`Lecture en-têtes échouée : ${hdrRes.status}`);
    const hdrData = await hdrRes.json();
    const headerRow: string[] = hdrData.values?.[0] ?? [];
    const newRow = buildRow(headerRow, data);

    // Append
    const appendRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A:Z`)}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [newRow] }),
      }
    );
    if (!appendRes.ok) {
      const text = await appendRes.text();
      throw new Error(`Ajout échoué : ${appendRes.status} ${text}`);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("sheets-client append:", e);
    return { ok: false, error: msg };
  }
}

export async function updateRowInSheet(
  memberId: string,
  data: SheetsMemberData,
  contactType: "communication" | "commercial" = "communication"
): Promise<{ ok: boolean; error?: string }> {
  const creds = parseServiceAccountKey();
  if (!creds)
    return {
      ok: false,
      error:
        "Clé du compte de service non configurée (NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY).",
    };
  if (!memberId?.startsWith("sheet-"))
    return { ok: false, error: "memberId invalide." };

  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
  const rangeA1 = contactType === "commercial"
    ? (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000")
    : (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Communication!A1:Z1000");
  if (!spreadsheetId)
    return { ok: false, error: "ID du tableur non configuré." };

  try {
    const token = await getAccessToken(creds);
    const rowIndex = parseInt(memberId.replace(/^sheet-/, ""), 10);
    if (Number.isNaN(rowIndex) || rowIndex < 0)
      return { ok: false, error: "Index de ligne invalide." };

    const sheetRowNum = rowIndex + 2;
    const sheetName = (rangeA1.match(/^([^!]+)!/)?.[1] ?? (contactType === "commercial" ? "Commercial" : "Communication")).replace(
      /^'|'$/g,
      ""
    );

    const headerRange = encodeURIComponent(`${sheetName}!A1:Z1`);
    const rowRange = encodeURIComponent(
      `${sheetName}!A${sheetRowNum}:Z${sheetRowNum}`
    );

    const [hdrRes, rowRes] = await Promise.all([
      fetch(`${SHEETS_API}/${spreadsheetId}/values/${headerRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${SHEETS_API}/${spreadsheetId}/values/${rowRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (!hdrRes.ok)
      throw new Error(`Lecture en-têtes échouée : ${hdrRes.status}`);
    if (!rowRes.ok) throw new Error(`Lecture ligne échouée : ${rowRes.status}`);

    const hdrData = await hdrRes.json();
    const rData = await rowRes.json();
    const headerRow: string[] = hdrData.values?.[0] ?? [];
    const currentRow: string[] = (rData.values?.[0] ?? []) as string[];
    const newRow = buildRow(headerRow, data, currentRow);

    const updateRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${rowRange}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [newRow] }),
      }
    );
    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(`Mise à jour échouée : ${updateRes.status} ${text}`);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("sheets-client update:", e);
    return { ok: false, error: msg };
  }
}

export async function deleteRowInSheet(
  memberId: string,
  contactType: "communication" | "commercial" = "communication"
): Promise<{ ok: boolean; error?: string }> {
  const creds = parseServiceAccountKey();
  if (!creds)
    return {
      ok: false,
      error:
        "Clé du compte de service non configurée (NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY).",
    };
  if (!memberId?.startsWith("sheet-"))
    return { ok: false, error: "memberId invalide." };

  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SPREADSHEET_ID;
  const rangeA1 = contactType === "commercial"
    ? (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE_COM ?? "Commercial!A1:Z1000")
    : (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_RANGE ?? "Communication!A1:Z1000");
  if (!spreadsheetId)
    return { ok: false, error: "ID du tableur non configuré." };

  try {
    const token = await getAccessToken(creds);
    const rowIndex = parseInt(memberId.replace(/^sheet-/, ""), 10);
    if (Number.isNaN(rowIndex) || rowIndex < 0)
      return { ok: false, error: "Index de ligne invalide." };

    const sheetRowNum = rowIndex + 2;
    const sheetName = (rangeA1.match(/^([^!]+)!/)?.[1] ?? (contactType === "commercial" ? "Commercial" : "Communication")).replace(
      /^'|'$/g,
      ""
    );

    // Get sheet ID
    const sheetsRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!sheetsRes.ok)
      throw new Error(`Lecture des feuilles échouée : ${sheetsRes.status}`);
    const sheetsData = await sheetsRes.json();
    
    // Normalize sheet name for comparison (trim and lowercase)
    const normalizedSheetName = sheetName.trim().toLowerCase();
    
    // Debug: log all sheet names
    const availableSheets = sheetsData.sheets?.map((s: { properties?: { title?: string } }) => s.properties?.title) || [];
    console.log(`[DELETE] Recherche de la feuille "${sheetName}" (normalisé: "${normalizedSheetName}") parmi:`, availableSheets);
    console.log(`[DELETE] contactType:`, contactType, `rangeA1:`, rangeA1);
    
    const sheet = sheetsData.sheets?.find(
      (s: { properties?: { title?: string; sheetId?: number } }) =>
        s.properties?.title?.trim().toLowerCase() === normalizedSheetName
    );
    if (!sheet?.properties?.sheetId) {
      const availableNames = availableSheets.join(", ");
      throw new Error(`Feuille "${sheetName}" introuvable. Feuilles disponibles: ${availableNames}`);
    }

    // Vérifier s'il ne reste qu'une seule ligne de données
    const dataRange = `${sheetName}!A:Z`;
    const dataRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(dataRange)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dataRes.ok) {
      throw new Error(`Lecture des données échouée : ${dataRes.status}`);
    }
    const dataJson = await dataRes.json();
    const allRows = dataJson.values || [];
    const totalRows = allRows.length;
    const dataRowsCount = totalRows - 1; // Exclure l'en-tête
    const isLastDataRow = dataRowsCount === 1 && sheetRowNum === 2;

    if (isLastDataRow) {
      // Au lieu de supprimer, vider la ligne pour éviter l'erreur Google Sheets
      const rowRange = `${sheetName}!A${sheetRowNum}:Z${sheetRowNum}`;
      const headerRow = allRows[0] || [];
      const rowData = allRows[1] || [];
      const emptyRow = Array(Math.max(headerRow.length, rowData.length)).fill("");

      const updateRes = await fetch(
        `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(rowRange)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [emptyRow] }),
        }
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        throw new Error(`Vidage de la ligne échoué : ${updateRes.status} ${text}`);
      }
      return { ok: true };
    }

    // Delete row using batchUpdate
    const batchUpdateRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }
    );
    if (!batchUpdateRes.ok) {
      const text = await batchUpdateRes.text();
      throw new Error(`Suppression échouée : ${batchUpdateRes.status} ${text}`);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("sheets-client delete:", e);
    return { ok: false, error: msg };
  }
}
