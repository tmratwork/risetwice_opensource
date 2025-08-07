// // src/hooksV11/audio-service-integration-example.tsx
// // Note: This is an example file showing how to integrate the audio service into a component

// import React, { useEffect } from 'react';
// import { useAudioService } from './use-audio-service';
// import { useWebRTC } from './use-webrtc';

// /**
//  * Example component showing how to integrate the audio service with WebRTC
//  */
// export const WebRTCWithAudioService: React.FC<{ userId: string, bookId: string }> = ({
//   userId,
//   bookId
// }) => {
//   // Get access to WebRTC functionality
//   const {
//     state,
//     transcript,
//     toggleRecording,
//     isRecording
//   } = useWebRTC({ userId, bookId });

//   // Get access to the audio service
//   const {
//     audioState,
//     hasAudioActivity,
//     isProcessingCurrentMessage,
//   } = useAudioService();

//   // Example of using audio state to control UI elements
//   const isSpeaking = audioState.isPlaying;
//   const showLoadingIndicator = hasAudioActivity && !isSpeaking;

//   // Safety mechanism - prevent user from leaving during audio
//   useEffect(() => {
//     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
//       if (isProcessingCurrentMessage) {
//         // Prevent leaving during audio playback
//         e.preventDefault();
//         e.returnValue = '';
//         return '';
//       }
//     };

//     window.addEventListener('beforeunload', handleBeforeUnload);
//     return () => {
//       window.removeEventListener('beforeunload', handleBeforeUnload);
//     };
//   }, [isProcessingCurrentMessage]);

//   return (
//     <div className="webrtc-container">
//       <div className="status-container">
//         <h3>Connection Status: {state.connectionState}</h3>

//         {/* Show audio playback information */}
//         <div className="audio-status">
//           <div>Audio Queue: {audioState.queueLength}</div>
//           <div>Playing: {audioState.isPlaying ? 'Yes' : 'No'}</div>
//           <div>Pending Chunks: {audioState.pendingChunksCount}</div>
//           <div>
//             {audioState.currentMessageId ?
//               `Processing message: ${audioState.currentMessageId}` :
//               'No active message'
//             }
//           </div>
//         </div>
//       </div>

//       <div className="conversation-container">
//         {/* Transcript area */}
//         <div className="transcript-area">
//           {transcript.map((entry, i) => (
//             <div key={i} className={`transcript-entry ${entry.role}`}>
//               <strong>{entry.role === 'user' ? 'You' : 'AI'}:</strong> {entry.content}
//             </div>
//           ))}

//           {/* Show loading indicator while processing but not yet speaking */}
//           {showLoadingIndicator && (
//             <div className="loading-indicator">Processing audio...</div>
//           )}

//           {/* Show speaking indicator while AI is speaking */}
//           {isSpeaking && (
//             <div className="speaking-indicator">
//               AI is speaking... {audioState.pendingChunksCount + audioState.queueLength} chunks remaining
//             </div>
//           )}
//         </div>

//         {/* Audio visualization and controls */}
//         <div className="audio-controls">
//           <button
//             onClick={toggleRecording}
//             disabled={hasAudioActivity} // Prevent recording during AI speech
//             className={isRecording ? 'recording' : ''}
//           >
//             {isRecording ? 'Stop Recording' : 'Start Recording'}
//           </button>

//           {/* Visual representation of audio state */}
//           <div className="audio-visualization">
//             <div
//               className={`audio-orb ${isSpeaking ? 'speaking' : ''}`}
//               style={{
//                 // Size based on queue length
//                 width: `${Math.min(60, 30 + audioState.queueLength * 2)}px`,
//                 height: `${Math.min(60, 30 + audioState.queueLength * 2)}px`,
//                 // Opacity based on queue size
//                 opacity: audioState.queueLength > 0 ? 1 : 0.5
//               }}
//             />
//           </div>
//         </div>
//       </div>

//       {/* Debug information */}
//       <div className="debug-panel">
//         <h4>Audio Service Debug Info</h4>
//         <pre>
//           {JSON.stringify({
//             audioState,
//             hasAudioActivity,
//             isProcessingCurrentMessage,
//             lastBufferTime: new Date(audioState.lastBufferTime).toISOString(),
//             audioContextState: audioState.audioContextState
//           }, null, 2)}
//         </pre>
//       </div>
//     </div>
//   );
// };

// export default WebRTCWithAudioService;