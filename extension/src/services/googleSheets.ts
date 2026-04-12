import { getStorageItem } from '../utils/storage';
import { db } from '../db';

interface GoogleSheetSettings {
  apiKey: string;
  spreadsheetId: string;
  range: string; // e.g., 'Sheet1!A2:J'
}

export const getGoogleSheetSettings = async (): Promise<GoogleSheetSettings | null> => {
  const apiKey = await getStorageItem<string>('gsApiKey');
  const spreadsheetId = await getStorageItem<string>('gsSpreadsheetId');
  const range = await getStorageItem<string>('gsRange') || 'Sheet1!A2:J';

  if (!apiKey || !spreadsheetId) return null;
  return { apiKey, spreadsheetId, range };
};

/**
 * Fetch projects from Google Sheets and sync them to the local database
 */
export const syncGoogleSheetProjects = async (): Promise<void> => {
  const settings = await getGoogleSheetSettings();
  if (!settings) throw new Error('Google Sheets settings not configured.');

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/${settings.range}?key=${settings.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Sheets API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // Clear existing projects to replace with the fresh list from the sheet
    await db.projects.clear();

    const projectsToInsert = rows.map((row: any[]) => {
      return {
        name: row[0] || 'Unknown Project',
        businessOwner: row[1] || '',
        priority: row[2] || 'Medium',
        status: row[3] || 'To Do',
        digitalResponsible: row[4] || '',
        startDate: row[5] || '',
        endDate: row[6] || '',
        comments: row[7] || '',
        devTotalMd: Number(row[8]) || 0,
        testTotalMd: Number(row[9]) || 0,
      };
    });

    if (projectsToInsert.length > 0) {
      await db.projects.bulkAdd(projectsToInsert);
    }
    
    console.log(`Synced ${projectsToInsert.length} projects from Google Sheets.`);
  } catch (error) {
    console.error('Failed to sync Google Sheets projects:', error);
    throw error;
  }
};
