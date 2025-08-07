// src/hooks/useSupabaseUpload.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseSupabaseUploadReturn {
    uploadAudio: (blob: Blob, userId: string) => Promise<string | null>;
    isUploading: boolean;
    uploadError: string | null;
}

export const useSupabaseUpload = (): UseSupabaseUploadReturn => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const uploadAudio = async (blob: Blob, userId: string): Promise<string | null> => {
        try {
            setIsUploading(true);
            setUploadError(null);

            // Create a unique filename
            const timestamp = new Date().getTime();
            const filename = `web_${timestamp}.webm`;

            // Upload to Supabase Storage
            const { error } = await supabase.storage
                .from('audio-recordings')
                .upload(`recordings/${userId}/${filename}`, blob, {
                    contentType: blob.type,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('audio-recordings')
                .getPublicUrl(`recordings/${userId}/${filename}`);

            return publicUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown upload error';
            setUploadError(errorMessage);
            console.error('Upload error:', err);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    return { uploadAudio, isUploading, uploadError };
};