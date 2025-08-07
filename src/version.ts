// Version configuration for V15
// Update this version number when making changes to help testers confirm they're running the latest code
// IMPORTANT: Increment the last number (XXX) for each test version to ensure testers see new logs

export const APP_VERSION = 'V16.2025.07.21.001'; // Format: V15.YYYY.MM.DD.XXX

// HOW TO UPDATE VERSION FOR TESTING:
// 1. Change APP_VERSION above (e.g., 001 -> 002 -> 003, etc.)
// 2. Save this file
// 3. Tester should refresh the page and look for the new version number in console logs

// Version history:
// V15.2024.12.14.001 - Fixed duplicate startSilenceDetection calls causing premature failsafe timeout