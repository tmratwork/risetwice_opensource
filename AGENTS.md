## RiseTwice Development Guidelines

### Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- **Formatting**: Uses Next.js core-web-vitals and TypeScript configurations
- **Imports**: Import from packages first, then local modules
- **Types**: Strongly typed with TypeScript, define interfaces for props and API responses
- **Error Handling**: Use try/catch with specific error handling, typed error responses
- **Naming**:
  - Files: Component files use PascalCase.tsx, utility files use camelCase.ts
  - Functions: camelCase starting with verb (useAiResponse, getAiResponse)
  - Components: PascalCase (AudioPlayer, Login)

### Architecture

- Next.js App Router with TypeScript
- Supabase for storage
- Firebase for authentication
- TailwindCSS for styling
- API routes with proper error handling and typed responses
