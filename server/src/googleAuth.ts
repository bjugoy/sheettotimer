import { google } from 'googleapis';

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(client: InstanceType<typeof google.auth.OAuth2>): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    prompt: 'consent',
  });
}

export interface Tokens {
  access_token:  string | null;
  refresh_token: string | null;
}

/** Build an authenticated OAuth2 client and capture any token refresh. */
function buildClient(tokens: Tokens): {
  auth:         InstanceType<typeof google.auth.OAuth2>;
  getFreshTokens: () => Tokens | null;
} {
  const auth = createOAuthClient();
  auth.setCredentials({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  let refreshed: Tokens | null = null;
  auth.on('tokens', (t) => {
    refreshed = {
      access_token:  t.access_token  ?? tokens.access_token,
      refresh_token: t.refresh_token ?? tokens.refresh_token,
    };
  });

  return { auth, getFreshTokens: () => refreshed };
}

/** Returns true if the authenticated user has edit access to the sheet.
 *  Uses batchUpdate with no operations — Google validates write permissions
 *  before processing, so this is a safe no-op permission probe. */
export async function checkCanEdit(
  tokens: Tokens,
  spreadsheetId: string,
): Promise<{ canEdit: boolean; freshTokens: Tokens | null }> {
  const { auth, getFreshTokens } = buildClient(tokens);
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [] },
    });
    return { canEdit: true, freshTokens: getFreshTokens() };
  } catch (err: unknown) {
    const code = (err as { code?: number; status?: number })?.code
                ?? (err as { code?: number; status?: number })?.status;
    if (code === 403) return { canEdit: false, freshTokens: getFreshTokens() };
    throw err;
  }
}

export async function fetchSheetData(
  tokens: Tokens,
  spreadsheetId: string,
  range = 'A:Z'
): Promise<{ headers: string[]; rows: Record<string, string | number | null>[]; freshTokens: Tokens | null }> {
  const { auth, getFreshTokens } = buildClient(tokens);
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const rawValues = res.data.values ?? [];
  if (rawValues.length === 0) return { headers: [], rows: [], freshTokens: getFreshTokens() };

  const headers = (rawValues[0] as string[]).map(h => String(h ?? ''));
  const rows = rawValues.slice(1).map(row => {
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, i) => {
      const v = row[i];
      obj[h] = v !== undefined ? (v as string | number) : null;
    });
    return obj;
  });

  return { headers, rows, freshTokens: getFreshTokens() };
}

export async function writeSheetData(
  tokens: Tokens,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<{ freshTokens: Tokens | null }> {
  const { auth, getFreshTokens } = buildClient(tokens);
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return { freshTokens: getFreshTokens() };
}
