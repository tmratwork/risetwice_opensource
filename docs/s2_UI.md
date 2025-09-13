# S2 UI Layout - Documentation

## Overview

This document captures the UI/layout lessons learned while implementing and fixing the S2 (Case Simulation) pages to match the chatbotV17 design system.

## Key UI Requirements

The S2 pages needed to match the chatbotV17 UI exactly:
1. **Same header** with proper RiseTwice logo (not emoji)
2. **Same background color** (darker sage green `#c1d7ca`)
3. **Same layout structure** using CSS Grid
4. **Step indicators** visible on every page
5. **Consistent button styling** using V17 control classes

## Critical Layout Issues Discovered

### 1. Background Color Confusion

**Problem:** S2 initially had lighter green background (`#e7ece9`) instead of darker green (`#c1d7ca`)

**Root Cause:** Wrong CSS variable usage
- `--bg-primary: #e7ece9` (lighter sage green) - for input backgrounds, etc.
- `--bg-secondary: #c1d7ca` (darker sage green) - for main page backgrounds

**Solution:** Changed all main backgrounds from `var(--bg-primary)` to `var(--bg-secondary)`

**Files affected:** All S2 component main container divs

### 2. Duplicate Headers Problem

**Problem:** Each S2 component had its own header with emoji logo, creating duplicate headers

**Root Cause:** Components were originally standalone pages, not integrated with the main layout system

**Solution:** 
- Removed all custom headers from individual components
- Used the layout's `ClientHeader` component which provides proper RiseTwice logo
- Integrated with `ThemeProvider` and `AuthProvider`

### 3. Header Overlap Issue

**Problem:** Step progress indicators ("Step X of Y") were hidden behind the standard header

**Root Cause:** The standard header uses CSS Grid layout but S2 components didn't account for header space

**Initial Fix:** Added `pt-4` (1rem padding-top) to progress indicator sections
**Final Fix:** Increased to `pt-8` (2rem padding-top) for better visual spacing

**Critical Pattern:**
```tsx
{/* Progress Indicator - needs pt-8 to clear header */}
<div style={{ backgroundColor: 'var(--bg-secondary)' }} className="border-b pt-8">
  <div className="max-w-4xl mx-auto px-4 py-6">
    <div className="text-center mb-4">
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Step X of Y</span>
    </div>
  </div>
</div>
```

## Layout Structure Pattern

### Correct S2 Layout Structure
```tsx
// Layout (s2/layout.tsx)
<AuthProvider>
  <ThemeProvider>
    <div className="v16-layout-root">
      <div className="header-row">
        <ClientHeader />  {/* Provides proper logo */}
      </div>
      <div className="main-content-row">
        {children}  {/* S2 components go here */}
      </div>
      <div className="footer-row">
        {/* Empty but maintains structure */}
      </div>
    </div>
  </ThemeProvider>
</AuthProvider>

// Individual S2 Components
<div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
  {/* Progress bar with pt-8 to clear header */}
  <div style={{ backgroundColor: 'var(--bg-secondary)' }} className="border-b pt-8">
    {/* Step indicator and progress bar */}
  </div>
  
  {/* Main content */}
  <main>
    {/* Component content */}
  </main>
</div>
```

## CSS Variable Usage Rules

### Background Colors
- `var(--bg-primary)`: `#e7ece9` - Use for input fields, secondary elements
- `var(--bg-secondary)`: `#c1d7ca` - Use for main page backgrounds (what S2 needs)

### Text Colors  
- `var(--text-primary)`: `#3b503c` - Use for headings, primary text
- `var(--text-secondary)`: `#3b503c` - Use for body text, descriptions

### Button Classes
- `control-button`: Base button styling
- `control-button primary`: Primary action buttons
- `control-button primary large-button`: Large primary buttons

## Component-Specific Fixes Applied

### 1. TherapistProfileForm (Step 1 of 5)
- Removed duplicate header with emoji
- Fixed background color: `var(--bg-secondary)`
- Added `pt-8` to progress bar
- Updated button styling to `control-button` classes

### 2. PatientDescriptionForm (Step 2 of 5)  
- Removed duplicate header
- Fixed background color
- Added `pt-8` to progress indicator
- Updated text colors to CSS variables

### 3. AIStyleCustomization (Step 3 of 5)
- Removed duplicate header with different emoji
- Fixed background color
- Added `pt-8` to progress indicator
- Updated navigation buttons

### 4. SessionPreparation (Step 4 of 5)
- Removed duplicate header
- Fixed background color
- Added `pt-8` to progress indicator
- Updated button styling

### 5. SessionInterface (Step 5 of 5)
- Fixed background color for loading state
- Updated main session container background
- Fixed text colors in session header

### 6. WelcomeScreen (Initial screen)
- Removed duplicate header
- Fixed background color
- Updated button styling

## Testing Checklist for S2 UI

When making S2 UI changes, verify:

- [ ] **Background color** matches V17 (darker sage green `#c1d7ca`)
- [ ] **Logo** is proper RiseTwice logo, not emoji
- [ ] **Step indicator** is visible and not hidden by header
- [ ] **Progress bar** has proper `pt-8` spacing from top
- [ ] **Text colors** use CSS variables, not hardcoded colors
- [ ] **Buttons** use `control-button` classes, not custom styling
- [ ] **No duplicate headers** - only the main layout header should show
- [ ] **Layout structure** uses `v16-layout-root` CSS Grid system

## Common Mistakes to Avoid

1. **Using `--bg-primary` for main backgrounds** - This gives the wrong (lighter) color
2. **Creating custom headers in components** - Use the layout's `ClientHeader`
3. **Forgetting top padding** - Step indicators will be hidden behind header
4. **Hardcoding colors** - Always use CSS variables for consistency
5. **Custom button styling** - Use existing `control-button` classes
6. **Not testing header overlap** - Always verify step indicators are visible

## Future S2 Development

When adding new S2 components:

1. **Start with the correct layout pattern** from this document
2. **Use `var(--bg-secondary)` for main backgrounds**
3. **Add `pt-8` to any top-level content that needs to clear the header**
4. **Use CSS variables for all colors**
5. **Use `control-button` classes for all buttons**
6. **Test header overlap on every screen**

This systematic approach will prevent the hours of debugging that were required to fix these layout issues initially.