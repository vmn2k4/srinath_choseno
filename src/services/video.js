import { supabase } from './supabase';

export async function uploadVideo(bucket, fileName, blob) {
  return supabase.storage.from(bucket).upload(fileName, blob, { contentType: 'video/webm' });
}

export function getVideoPublicUrl(bucket, fileName) {
  return supabase.storage.from(bucket).getPublicUrl(fileName);
}
