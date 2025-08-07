# UserProfileDisplay Component

A flexible component for displaying user profile data with a clean, consistent UI regardless of the data structure. This component is designed to handle any profile structure without making assumptions about fields.

## Features

- Renders any nested object structure dynamically
- Works with unpredictable or changing AI-generated data structures
- Applies appropriate formatting for different data types
- Uses relevant icons based on field names
- Formats timestamps for readability
- Supports dark mode
- Fully responsive layout

## Usage

```tsx
import UserProfileDisplay from '@/components/UserProfileDisplay';

// Example with profile data from API
const ProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      const response = await fetch('/api/v11/user-profile?userId=123');
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    };
    
    fetchProfile();
  }, []);
  
  if (!userProfile) return <div>Loading...</div>;
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <UserProfileDisplay 
        profileData={userProfile.profile} 
        lastUpdated={userProfile.lastUpdated} 
      />
    </div>
  );
};
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `profileData` | `Record<string, any>` | The profile data object with arbitrary structure. Can contain nested objects, arrays, and primitive values. |
| `lastUpdated` | `string \| number \| undefined` | Optional timestamp when the profile was last updated. Can be ISO string or numeric timestamp. |

## Handling Different Data Types

The component handles various data types and structures:

- **Objects**: Rendered as sections with nested content
- **Arrays**: Rendered as bullet point lists
- **Primitive values**: Rendered as labeled text
- **Nested structures**: Rendered recursively with appropriate indentation

## Icon Mapping

The component automatically assigns relevant icons based on field names:

| Field Contains | Icon |
|---------------|------|
| goals | 🎯 |
| personal_details | 👤 |
| health | 🏥 |
| coping | 🧠 |
| emotion | 😊 |
| trigger | ⚠️ |
| preference | 👍 |
| engagement | 💬 |
| conversation | 🗣️ |
| confidence | 📊 |

## Integration with AI Memory Panels

This component is designed to work with the `AIRemembersPanel` component for a complete user memory display:

```tsx
import AIRemembersPanel from '@/components/AIRemembersPanel';

const InsightsPage = () => {
  // ... other code ...

  return (
    <div>
      <AIRemembersPanel
        userProfile={userProfile}
        profileLoading={profileLoading}
        profileError={profileError}
        onRefreshProfile={refreshUserProfile}
        onClearProfile={clearUserProfile}
        expanded={aiRemembersPanelExpanded}
        onToggleExpand={() => setAiRemembersPanelExpanded(!aiRemembersPanelExpanded)}
      />
      
      {/* Other page content */}
    </div>
  );
};
```