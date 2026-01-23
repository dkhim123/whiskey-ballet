/**
 * Automatic Backup System for Whiskey Ballet POS
 * 
 * Three-Layer Backup Strategy:
 * Layer 1: localStorage (primary, real-time)
 * Layer 2: IndexedDB (automatic daily backups)
 * Layer 3: Manual exports (CSV, XLSX, PDF)
 */

// IndexedDB Database Name and Version
const DB_NAME = 'WhiskeyBalletBackupDB';
const DB_VERSION = 1;
const BACKUP_STORE = 'backups';

/**
 * Initialize IndexedDB for backups
 */
export function initBackupDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create backup object store if it doesn't exist
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        const store = db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('date', 'date', { unique: true });
      }
    };
  });
}

/**
 * Save backup to IndexedDB
 */
export async function saveBackupToIndexedDB(data) {
  const db = await initBackupDB();
  const date = new Date();
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const backup = {
    id: `backup-${dateString}`,
    date: dateString,
    timestamp: date.getTime(),
    data: data,
    size: JSON.stringify(data).length,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readwrite');
    const store = transaction.objectStore(BACKUP_STORE);
    const request = store.put(backup);

    request.onsuccess = () => resolve(backup);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get all backups from IndexedDB
 */
export async function getAllBackups() {
  const db = await initBackupDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readonly');
    const store = transaction.objectStore(BACKUP_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get a specific backup by date
 */
export async function getBackupByDate(dateString) {
  const db = await initBackupDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readonly');
    const store = transaction.objectStore(BACKUP_STORE);
    const index = store.index('date');
    const request = index.get(dateString);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete old backups (keep last 30 days)
 */
export async function cleanOldBackups(daysToKeep = 30) {
  const db = await initBackupDB();
  const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readwrite');
    const store = transaction.objectStore(BACKUP_STORE);
    const index = store.index('timestamp');
    const request = index.openCursor();
    
    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.timestamp < cutoffDate) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => {
      db.close();
      resolve(deletedCount);
    };
  });
}

/**
 * Check if backup is needed for today
 */
export function shouldBackupToday(lastBackupDate) {
  if (!lastBackupDate) return true;
  
  const today = new Date().toISOString().split('T')[0];
  return lastBackupDate !== today;
}

/**
 * Perform automatic daily backup
 */
export async function performDailyBackup(data, settings) {
  try {
    // Check if backup is needed
    if (!shouldBackupToday(settings.lastBackupDate)) {
      return { success: false, reason: 'Backup already done today' };
    }

    // Save to IndexedDB
    const backup = await saveBackupToIndexedDB(data);
    
    // Clean old backups
    const deletedCount = await cleanOldBackups(30);
    
    return {
      success: true,
      backup: backup,
      deletedOldBackups: deletedCount,
      message: `Backup created successfully for ${backup.date}`
    };
  } catch (error) {
    console.error('Daily backup failed:', error);
    
    // Check if quota exceeded
    if (error.name === 'QuotaExceededError') {
      return {
        success: false,
        quotaExceeded: true,
        error: error,
        message: 'IndexedDB storage quota exceeded. Please download a manual backup and clear old data.'
      };
    }
    
    return {
      success: false,
      error: error,
      message: `Backup failed: ${error.message}`
    };
  }
}

/**
 * Restore from IndexedDB backup
 */
export async function restoreFromBackup(dateString) {
  try {
    const backup = await getBackupByDate(dateString);
    
    if (!backup) {
      throw new Error('Backup not found for the specified date');
    }
    
    return {
      success: true,
      data: backup.data,
      backup: backup
    };
  } catch (error) {
    console.error('Restore failed:', error);
    return {
      success: false,
      error: error,
      message: `Restore failed: ${error.message}`
    };
  }
}

/**
 * Get backup statistics
 */
export async function getBackupStats() {
  try {
    const backups = await getAllBackups();
    
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const oldestBackup = backups.length > 0 ? 
      new Date(Math.min(...backups.map(b => b.timestamp))) : null;
    const newestBackup = backups.length > 0 ? 
      new Date(Math.max(...backups.map(b => b.timestamp))) : null;
    
    return {
      count: backups.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      oldestBackup: oldestBackup,
      newestBackup: newestBackup,
      backups: backups.sort((a, b) => b.timestamp - a.timestamp)
    };
  } catch (error) {
    console.error('Failed to get backup stats:', error);
    return {
      count: 0,
      totalSize: 0,
      error: error
    };
  }
}

/**
 * Delete a specific backup
 */
export async function deleteBackup(backupId) {
  const db = await initBackupDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readwrite');
    const store = transaction.objectStore(BACKUP_STORE);
    const request = store.delete(backupId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete all backups (clear IndexedDB)
 */
export async function deleteAllBackups() {
  const db = await initBackupDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BACKUP_STORE], 'readwrite');
    const store = transaction.objectStore(BACKUP_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Export backup as JSON file
 */
export function downloadBackupAsJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `whiskeyballet-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data, headers) {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      const escaped = String(value || '').replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
