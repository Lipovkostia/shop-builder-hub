/**
 * Get the best supported audio MIME type for MediaRecorder
 * iOS Safari: audio/mp4 or audio/aac
 * Chrome/Firefox/Android: audio/webm
 */
export function getSupportedAudioMimeType(): string {
  const types = [
    'audio/webm',      // Preferred for Chrome/Firefox/Android
    'audio/mp4',       // iOS Safari
    'audio/aac',       // iOS fallback
    'audio/ogg',       // Firefox fallback
    'audio/wav',       // Universal fallback
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Return empty string to use browser default
  return '';
}

/**
 * Get file extension for audio MIME type
 */
export function getAudioFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  };
  return extensions[mimeType] || 'audio';
}
