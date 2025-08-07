/**
 * INSTALLATION INSTRUCTIONS
 * 
 * 1. Copy the UserProfileDisplay.tsx component to /src/components/
 * 2. Add the import at the top of your insights page:
 *    import UserProfileDisplay from '@/components/UserProfileDisplay';
 * 3. Find the section in your page that renders the profile (around line 1750)
 * 4. Replace the existing profile rendering code with:
 * 
 * <UserProfileDisplay 
 *   profileData={userProfile.profile} 
 *   lastUpdated={userProfile.lastUpdated} 
 * />
 * 
 * This component will automatically handle any JSON structure returned by the AI
 * without requiring you to update the code when the structure changes.
 */

// Here's how to use the component in your page:

// 1. Import at the top of your file
import UserProfileDisplay from '@/components/UserProfileDisplay';

// 2. Use it in your rendering code
return (
  <div className="your-container-classes">
    {/* Other content */}
    
    {userProfile && (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
        <h2 className="text-xl font-semibold mb-4">User Profile</h2>
        
        <UserProfileDisplay 
          profileData={userProfile.profile} 
          lastUpdated={userProfile.lastUpdated} 
        />
      </div>
    )}
    
    {/* Other content */}
  </div>
);