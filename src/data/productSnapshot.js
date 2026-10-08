// A 1 MB upload grows to about 1.4 million characters when encoded as a data URL.
// Do not truncate image sources: partial URLs cannot be displayed.
export const SNAPSHOT_IMAGE_MAX_LENGTH = 1400000;
export const snapshotImage = (value) => typeof value === 'string' && value.length <= SNAPSHOT_IMAGE_MAX_LENGTH ? value.trim() : '';
