import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseBackupText, type FullBackup } from '../../domain/backup';
import { createFullBackup, type BackupDatabase } from '../../db/repositories/backup';

/** The user chooses the destination (for example, Save to Files) in the share sheet. */
export async function shareFullBackup(db: BackupDatabase): Promise<FullBackup> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is unavailable on this device.');
  }
  const backup = await createFullBackup(db, Constants.expoConfig?.version ?? 'unknown');
  const file = new File(Paths.cache, `treat-tracker-backup-${Date.now()}.json`);
  file.create();
  try {
    file.write(JSON.stringify(backup));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    return backup;
  } finally {
    // The document chosen in Files is a separate copy; do not retain a second
    // private export in the app's temporary directory.
    file.delete();
  }
}

/** Returns null when the iOS document picker is dismissed without a file. */
export async function pickFullBackup(): Promise<FullBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No backup file was selected.');
  const file = new File(asset.uri);
  try {
    return parseBackupText(await file.text());
  } finally {
    file.delete();
  }
}
