import * as XLSX from 'xlsx';
import { db } from '../db';

export const importProjectsFromFile = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // header: 1 reads the sheet as an array of arrays
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          throw new Error('文件中没有数据行');
        }

        // Drop the header row and map data
        const projectsToInsert = rows.slice(1).map(row => {
          return {
            name: row[0]?.toString() || 'Unknown Project',
            businessOwner: row[1]?.toString() || '',
            priority: row[2]?.toString() || 'Medium',
            status: row[3]?.toString() || 'To Do',
            digitalResponsible: row[4]?.toString() || '',
            startDate: row[5]?.toString() || '',
            endDate: row[6]?.toString() || '',
            estimatedGoLiveTime: row[7]?.toString() || '',
            comments: row[8]?.toString() || '',
            jiraEpicKey: row[9]?.toString() || '',
            devTotalMd: Number(row[10]) || 0,
            testTotalMd: Number(row[11]) || 0,
          };
        }).filter(p => p.name !== 'Unknown Project' || p.businessOwner !== ''); // filter empty rows

        await db.projects.clear();
        if (projectsToInsert.length > 0) {
          await db.projects.bulkAdd(projectsToInsert);
        }
        
        resolve(projectsToInsert.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
