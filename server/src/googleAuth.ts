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
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    prompt: 'consent',
  });
}

export async function fetchSheetData(
  accessToken: string,
  spreadsheetId: string,
  range = 'A:Z'
): Promise<{ headers: string[]; rows: Record<string, string | number | null>[] }> {
  const auth = createOAuthClient();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const rawValues = res.data.values ?? [];
  if (rawValues.length === 0) return { headers: [], rows: [] };

  const headers = (rawValues[0] as string[]).map(h => String(h ?? ''));
  const rows = rawValues.slice(1).map(row => {
    const obj: Record<string, string | number | null> = {};
    headers.forEach((h, i) => {
      const v = row[i];
      obj[h] = v !== undefined ? (v as string | number) : null;
    });
    return obj;
  });

  return { headers, rows };
}

export async function writeSheetData(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][]
): Promise<void> {
  const auth = createOAuthClient();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
