# Fix for User Profile Display

There appears to be a syntax error in the page.tsx file after our modifications. Let's work around this by just integrating the new UserProfileDisplay component in a simpler way.

## Step 1: Make sure you've added the component

Check that the `UserProfileDisplay.tsx` file has been created at:
```
/Users/tmr/github/living_books/src/components/UserProfileDisplay.tsx
```

## Step 2: Import the component in your page.tsx file

Add this import at the top of your file:
```tsx
import UserProfileDisplay from '@/components/UserProfileDisplay';
```

## Step 3: Find the profile rendering section

Look for the section in your code that renders the user profile (around line 1750, in the "What AI Remembers" section).

## Step 4: Replace just the relevant part with this code

Find the part where you render the profile data. It might look something like:
```tsx
{Object.keys(userProfile?.profile || {}).length > 0 ? (
  <div className="space-y-4 max-w-none">
    {/* Your existing profile rendering code */}
  </div>
) : (
  <div className="text-gray-700 dark:text-gray-400 italic py-2">
    No profile data available yet. Have more conversations to help the AI learn about you.
  </div>
)}
```

And replace JUST the profile rendering part with:
```tsx
{Object.keys(userProfile?.profile || {}).length > 0 ? (
  <div className="space-y-4 max-w-none">
    <UserProfileDisplay 
      profileData={userProfile.profile} 
      lastUpdated={userProfile.lastUpdated} 
    />
  </div>
) : (
  <div className="text-gray-700 dark:text-gray-400 italic py-2">
    No profile data available yet. Have more conversations to help the AI learn about you.
  </div>
)}
```

## Step 5: Check for unbalanced tags

The syntax error suggests there might be unbalanced tags or braces. Look for any:
- Unclosed JSX tags
- Unbalanced braces `{}`
- Unbalanced parentheses `()`
- Comments that might be cutting off code

## Alternative: Try using your page.tsx.bak file

If the syntax issues persist, you might want to:
1. Make a copy of your backup file: `cp /Users/tmr/github/living_books/src/app/chatbotV11/insights/page.tsx.bak /Users/tmr/github/living_books/src/app/chatbotV11/insights/page.tsx`
2. Then manually add the import and the UserProfileDisplay component to the profile section

This should help get your page working again while still using the new flexible profile display component.