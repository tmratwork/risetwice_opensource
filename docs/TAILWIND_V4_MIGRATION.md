file: docs/TAILWIND_V4_MIGRATION.md

# Tailwind v4 Migration Guide

This document provides guidance on migrating the LivingBooks application to Tailwind CSS v4 when ready.

## Current Implementation

- We've updated the dark mode background color to match Claude.ai's dark theme (`#131314`) in our CSS variables.
- We're still using Tailwind v3 with class-based dark mode.

## Prepared Files for v4 Migration

We've created preparation files that follow Tailwind v4's new CSS-based configuration approach:

- `globals.v4.css`: Updated CSS with Tailwind v4 syntax using `@custom-variant`, `@theme`, and `@layer`
- `tailwind.config.v4.ts`: Simplified config file compatible with v4

## Migration Steps

When you're ready to migrate to Tailwind v4, follow these steps:

1. Update dependencies in package.json:
   ```json
   "tailwindcss": "^4.0.0"
   ```

2. Rename and replace files:
   ```
   mv src/app/globals.v4.css src/app/globals.css
   mv tailwind.config.v4.ts tailwind.config.ts
   ```

3. Check for any utility class usage that might have changed in v4:
   - Some utility classes may have been renamed or removed
   - Class merging behavior might be different
   - Color opacity syntax has changed (now using `/` instead of `/[opacity]`)

4. Update any components that rely on dark mode:
   - Make sure all components work correctly with the new dark mode implementation
   - Test all UI states in both light and dark mode

5. Test thoroughly:
   - Mobile and desktop views
   - Different browsers
   - All interactive elements

## Key Tailwind v4 Changes

### CSS-Based Configuration

Tailwind v4 favors CSS-based configuration over JavaScript. Major themes and variants are defined in CSS:

```css
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Light mode variables */
}

@layer base {
  @variant dark {
    /* Dark mode variables */
  }
}
```

### New Directive Syntax

- `@custom-variant`: Defines custom variants (like dark mode)
- `@theme`: Defines theme values that influence which utility classes exist
- `@layer`: Groups styles logically

### Color Opacity Syntax

Old: `bg-blue-500/75`
New: `bg-blue-500/75%`

### Simplified JavaScript Config

JavaScript config focuses on file paths and plugins, with most theming moved to CSS.

## References

- [Tailwind CSS v4 Documentation](https://tailwindcss.com)
- [Upgrading to v4 Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Dark Mode in v4](https://tailwindcss.com/docs/dark-mode)