// // src/hooksV11/use-audio-service-example.tsx

// import React, { useEffect } from 'react';
// import useAudioService from './use-audio-service';

// /**
//  * Example component demonstrating how to use the useAudioService hook.
//  * This is just for demonstration purposes and not meant for production use.
//  */
// export function AudioServiceDemo() {
//   // Use the audio service hook
//   const {
//     isAudioPlaying,
//     hasPendingChunks,
//     audioQueueLength,
//     hasStopSignal,
//     currentMessageId,
//     audioContextState,
    
//     // Service methods
//     queueAudioData,
//     handleStopSignal,
//     clearAudioQueue,
//     startNewMessage
//   } = useAudioService();

//   // Example of starting a new message session
//   const handleStartNewSession = () => {
//     const newMessageId = `msg-${Date.now()}`;
//     startNewMessage(newMessageId);
//     console.log(`Started new message session: ${newMessageId}`);
//   };

//   // Example of loading and queuing a test audio file
//   const handlePlayTestAudio = async () => {
//     try {
//       // Only create a new message if none exists
//       if (!currentMessageId) {
//         handleStartNewSession();
//       }
      
//       // Fetch a test audio file
//       const response = await fetch('/test-audio.mp3');
//       const arrayBuffer = await response.arrayBuffer();
      
//       // Queue the audio data
//       const chunkId = `chunk-${Date.now()}`;
//       queueAudioData(arrayBuffer, chunkId, currentMessageId || `msg-${Date.now()}`);
      
//       console.log('Queued test audio file for playback');
//     } catch (error) {
//       console.error('Error loading test audio:', error);
//     }
//   };

//   // Example of handling a stop signal
//   const handleStop = () => {
//     if (currentMessageId) {
//       handleStopSignal(currentMessageId);
//       console.log('Sent stop signal for current message');
//     } else {
//       console.warn('No active message to stop');
//     }
//   };

//   // Example of clearing the audio queue
//   const handleClearQueue = () => {
//     const wasCleared = clearAudioQueue();
//     if (wasCleared) {
//       console.log('Audio queue cleared successfully');
//     } else {
//       console.log('Could not clear audio queue (might be playing or has protected chunks)');
      
//       // If you need to force clear even during playback
//       const forceClear = window.confirm('Force clear the audio queue?');
//       if (forceClear) {
//         clearAudioQueue(true);
//         console.log('Audio queue force cleared');
//       }
//     }
//   };

//   // Log state changes for demonstration
//   useEffect(() => {
//     console.log('Audio service state changed:', {
//       isAudioPlaying,
//       hasPendingChunks,
//       audioQueueLength,
//       hasStopSignal,
//       currentMessageId,
//       audioContextState
//     });
//   }, [
//     isAudioPlaying,
//     hasPendingChunks,
//     audioQueueLength,
//     hasStopSignal,
//     currentMessageId,
//     audioContextState
//   ]);

//   return (
//     <div className="p-4 border rounded-lg">
//       <h2 className="text-xl font-medium mb-4">Audio Service Demo</h2>
      
//       <div className="grid grid-cols-2 gap-4 mb-4">
//         <button 
//           onClick={handleStartNewSession}
//           className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//           disabled={isAudioPlaying}
//         >
//           Start New Session
//         </button>
        
//         <button 
//           onClick={handlePlayTestAudio}
//           className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
//         >
//           Play Test Audio
//         </button>
        
//         <button 
//           onClick={handleStop}
//           className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
//           disabled={!isAudioPlaying && !hasPendingChunks}
//         >
//           Send Stop Signal
//         </button>
        
//         <button 
//           onClick={handleClearQueue}
//           className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
//         >
//           Clear Audio Queue
//         </button>
//       </div>
      
//       <div className="bg-gray-100 p-4 rounded-lg">
//         <h3 className="text-lg font-medium mb-2">Audio State</h3>
//         <div className="grid grid-cols-2 gap-2">
//           <div className="font-medium">Playing:</div>
//           <div>{isAudioPlaying ? 'Yes' : 'No'}</div>
          
//           <div className="font-medium">Queue Length:</div>
//           <div>{audioQueueLength}</div>
          
//           <div className="font-medium">Pending Chunks:</div>
//           <div>{hasPendingChunks ? 'Yes' : 'No'}</div>
          
//           <div className="font-medium">Stop Signal:</div>
//           <div>{hasStopSignal ? 'Received' : 'Not Received'}</div>
          
//           <div className="font-medium">Message ID:</div>
//           <div>{currentMessageId || 'None'}</div>
          
//           <div className="font-medium">Audio Context:</div>
//           <div>{audioContextState}</div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default AudioServiceDemo;