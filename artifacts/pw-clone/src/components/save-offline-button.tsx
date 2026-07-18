// Save-offline functionality was removed (PW videos are DRM-protected via
// CloudFront signed cookies — segment caching is not possible without auth).
// This file is kept as an empty export so existing imports don't break.
export function SaveOfflineButton(_props: {
  videoId: string;
  batchId: string;
  subjectId: string;
  title: string;
  thumbnail?: string;
}) {
  return null;
}
