import { Platform } from 'react-native';

/**
 * iOS deletes park in Recently Deleted for ~30 days before the space comes back, so "free up"
 * and "deletes" would overpromise there — the hint says where the original actually goes.
 */
export const REPLACE_HINT = Platform.select({
  ios: 'Moves the original to Recently Deleted — the system will ask to confirm',
  default: 'Deletes the original video — the system will ask to confirm',
});
