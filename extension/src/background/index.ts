import { syncGoogleSheetProjects } from '../services/googleSheets';

console.log('Background service worker started.');

// Set up periodic sync alarm
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed. Setting up alarms...');
  chrome.alarms.create('gs-sync-alarm', {
    periodInMinutes: 60 // Sync every hour
  });
});

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gs-sync-alarm') {
    console.log('Triggering scheduled Google Sheets Sync...');
    syncGoogleSheetProjects().catch(err => {
      console.error('Scheduled Google Sheets sync failed (might not be configured yet):', err);
    });
  }
});
