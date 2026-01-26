import { Recording } from '@/types';

/**
 * Get display title for a recording, showing part info if multi-part
 */
export function getRecordingTitle(recording: Recording): string {
  const baseLabel = recording.label || '錄音';

  if (recording.partNumber && recording.totalParts) {
    // Completed multi-part: "錄音 (第 2/3 部分)"
    return `${baseLabel} (第 ${recording.partNumber}/${recording.totalParts} 部分)`;
  } else if (recording.partNumber) {
    // In-progress multi-part: "錄音 (第 2 部分 - 錄音中...)"
    return `${baseLabel} (第 ${recording.partNumber} 部分 - 錄音中...)`;
  }

  return baseLabel;
}

/**
 * Get subtitle showing recording info (duration + part info if applicable)
 */
export function getRecordingSubtitle(recording: Recording): string {
  const minutes = Math.floor(recording.duration / 60);
  const seconds = recording.duration % 60;
  const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (recording.partNumber && !recording.totalParts) {
    // Part in progress
    return `${durationText} - 部分 ${recording.partNumber}`;
  } else if (recording.totalParts && recording.totalParts > 1) {
    // Completed multi-part
    return `${durationText} - 共 ${recording.totalParts} 部分`;
  }

  return durationText;
}

/**
 * Check if a recording is part of a multi-part series
 */
export function isMultiPartRecording(recording: Recording): boolean {
  return !!(recording.partNumber || recording.parentRecordingId || recording.totalParts);
}

/**
 * Check if recording is still being recorded (part of incomplete series)
 */
export function isRecordingInProgress(recording: Recording): boolean {
  return !!(recording.partNumber && !recording.totalParts);
}

/**
 * Get all parts of a multi-part recording
 */
export function getRecordingParts(
  recordingId: string,
  allRecordings: Recording[]
): Recording[] {
  const recording = allRecordings.find(r => r.id === recordingId);
  if (!recording) return [];

  // Find the parent ID
  const parentId = recording.parentRecordingId || recording.id;

  // Get all parts (including parent)
  const parts = allRecordings.filter(
    r => r.id === parentId || r.parentRecordingId === parentId
  );

  // Sort by part number
  return parts.sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
}

/**
 * Check if recording should be shown in library (hide incomplete parts)
 */
export function shouldShowInLibrary(recording: Recording, allRecordings: Recording[]): boolean {
  // Always show if not multi-part
  if (!isMultiPartRecording(recording)) return true;

  // If this is a child part (has parentRecordingId), don't show
  if (recording.parentRecordingId) return false;

  // If this is the parent/first part, only show if completed (has totalParts)
  if (recording.partNumber === 1 || !recording.partNumber) {
    return !!recording.totalParts;
  }

  // For other parts, don't show separately
  return false;
}
