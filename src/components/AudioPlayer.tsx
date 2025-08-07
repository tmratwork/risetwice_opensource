// src/components/AudioPlayer.tsx
import { useEffect, useRef } from 'react';
import { monitorAudioElement } from '@/hooksV11';

interface AudioPlayerProps {
    audioUrl: string | null;
    label?: string;
}

export const AudioPlayer = ({ audioUrl, label }: AudioPlayerProps) => {
    // Reference to the audio element
    const audioRef = useRef<HTMLAudioElement>(null);
    
    // Track player instance ID to ensure unique monitoring instances
    const playerIdRef = useRef<string>(`player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    
    // Set up monitoring on component mount and when URL changes
    useEffect(() => {
        if (audioRef.current && audioUrl) {
            // Determine source type from URL
            const sourceType = audioUrl.includes('blob:') ? 'blob' :
                               audioUrl.includes('/audio-responses/') ? 'audio-response' : 
                               'file';
            
            // Install monitoring on the audio element
            monitorAudioElement(audioRef.current, {
                id: playerIdRef.current,
                label: label || `AudioPlayer-${sourceType}`,
                source_type: sourceType
            });
            
            console.log(`[AUDIO-PLAYER] Initialized player ${playerIdRef.current} with source: ${sourceType}`);
        }
    }, [audioUrl, label]);
    
    // No render if no audio URL
    if (!audioUrl) return null;
    
    return (
        <div className="flex flex-col items-center" data-player-id={playerIdRef.current}>
            {label && <div className="text-sm text-gray-600 mb-2">{label}</div>}
            <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-64"
                onEnded={() => {
                    console.log(`[AUDIO-PLAYER] Audio ended: ${playerIdRef.current}`);
                    // Only revoke object URL if it's a blob URL
                    if (audioUrl.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(audioUrl);
                            console.log(`[AUDIO-PLAYER] Revoked object URL: ${audioUrl.substring(0, 30)}...`);
                        } catch (err) {
                            console.error(`[AUDIO-PLAYER] Error revoking URL:`, err);
                        }
                    }
                }}
                // Add data attributes for easier debugging
                data-audio-type={audioUrl.startsWith('blob:') ? 'blob' : 'file'}
                data-player-id={playerIdRef.current}
            />
        </div>
    );
};