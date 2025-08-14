file: docs/accessibility.md

# RiseTwice Accessibility Guidelines

## Core Accessibility Principles

### **Golden Rule: Invisible to Sighted Users**
All accessibility improvements MUST be completely invisible to sighted users. The visual design, layout, interactions, and user experience must remain identical for users who don't use assistive technology.

### **Progressive Enhancement Approach**
Accessibility features are additive layers that enhance the experience for users with disabilities without affecting the base experience for anyone else.

## Implementation Rules

### **1. Visual Impact: Zero Tolerance**
- **NO changes** to CSS styling, colors, fonts, spacing, or layouts
- **NO changes** to existing visual elements or their appearance
- **NO changes** to button sizes, positions, or visual states
- **NO changes** to existing animations or visual feedback

### **2. Functional Impact: Preserve Everything**
- **ALL existing functionality** must work exactly the same way
- **ALL existing user flows** must remain unchanged
- **ALL existing interactions** (clicks, hovers, keyboard shortcuts) must work identically
- **NO breaking changes** to current user workflows

### **3. Performance Impact: Minimal**
- Accessibility attributes add negligible overhead
- Screen reader-only text uses `className="sr-only"` (already in CSS)
- No additional JavaScript unless absolutely necessary

## Approved Accessibility Techniques

### **✅ ALLOWED: Invisible Additions**

#### **ARIA Attributes (Screen Reader Only):**
```tsx
// BEFORE
<button onClick={handleClick}>Let's Talk</button>

// AFTER (identical visual appearance)
<button 
  onClick={handleClick}
  aria-label="Start a new conversation with RiseTwice AI"
>
  Let's Talk
</button>
```

#### **Hidden Screen Reader Text:**
```tsx
// BEFORE
<input placeholder="Type your message..." />

// AFTER (placeholder still visible, label invisible to sighted users)
<label htmlFor="message-input" className="sr-only">
  Type your message to RiseTwice AI
</label>
<input 
  id="message-input" 
  placeholder="Type your message..." 
/>
```

#### **Semantic HTML Structure:**
```tsx
// BEFORE
<div className="main-container">

// AFTER (identical visual styling, better semantic structure)
<main className="main-container" aria-labelledby="page-title">
  <h1 id="page-title" className="sr-only">RiseTwice AI Chat Interface</h1>
```

#### **Live Regions for Dynamic Content:**
```tsx
// BEFORE
<div className="conversation-history">

// AFTER (same visual appearance, announces new messages)
<div 
  className="conversation-history"
  role="log" 
  aria-live="polite" 
  aria-label="Conversation with AI assistant"
>
```

#### **SVG Icon Accessibility:**
```tsx
// BEFORE
<svg>...</svg>

// AFTER (same visual appearance, properly hidden from screen readers)
<svg aria-hidden="true">...</svg>
```

### **❌ FORBIDDEN: Visible Changes**

#### **Never Change:**
- Button colors, sizes, or visual states
- Text that's visible to sighted users
- Layout or positioning of elements  
- Existing hover/focus visual effects
- Font sizes, weights, or families
- Spacing, margins, or padding

#### **Never Add:**
- New visible UI elements
- Visible text labels where none existed
- New buttons or controls
- Additional visual indicators

## ChatbotV16 Accessibility Requirements

### **Current State Analysis**
The chatbot interface has significant accessibility barriers:

1. **Missing page structure** - No semantic landmarks or headings
2. **Unlabeled form controls** - Message input lacks proper labeling
3. **No live announcements** - AI responses not announced to screen readers
4. **Incomplete button descriptions** - Interactive elements lack context
5. **Missing status updates** - Connection states not announced
6. **Poor focus management** - Modal dialogs lack keyboard support

### **Priority Implementation Order**

#### **Phase 1: Core Structure (Immediate)**
1. Add semantic HTML landmarks (`<main>`, proper headings)
2. Add live regions for dynamic content announcements
3. Fix form labeling for message input
4. Add comprehensive ARIA labels to all interactive elements

#### **Phase 2: Enhanced Experience (Secondary)**
1. Improve modal dialog accessibility
2. Add connection status announcements  
3. Fix SVG icon accessibility
4. Enhance focus management

#### **Phase 3: Advanced Features (Future)**
1. Keyboard shortcuts for power users
2. Voice input status announcements
3. Audio visualization alternatives
4. Advanced navigation aids

## Testing Requirements

### **Pre-Implementation Testing**
- Document current visual appearance (screenshots)
- Test all existing functionality works correctly
- Verify performance baseline

### **Post-Implementation Testing**
- **Visual regression testing** - Confirm zero visual changes
- **Functional testing** - All features work identically
- **Screen reader testing** - Test with NVDA, JAWS, VoiceOver
- **Keyboard navigation testing** - All functionality accessible via keyboard
- **Performance testing** - No measurable performance impact

### **Screen Reader Testing Checklist**
- [ ] Page structure navigable by headings
- [ ] All interactive elements have accessible names
- [ ] Form controls properly labeled and associated
- [ ] Dynamic content announced appropriately
- [ ] Error messages announced and associated
- [ ] Modal dialogs properly announced and managed
- [ ] Status changes announced to users

## Maintenance Guidelines

### **Ongoing Rules**
- Every new UI component MUST include accessibility from day one
- All interactive elements MUST have accessible names
- All forms MUST have proper labels
- All dynamic content MUST use appropriate live regions
- All modal dialogs MUST implement proper focus management

### **Code Review Requirements**
- Accessibility attributes reviewed for all new components
- Screen reader impact assessed for all UI changes  
- Keyboard navigation tested for all interactive elements
- Visual regression confirmed for all accessibility additions

## Success Metrics

### **User Experience Goals**
- **Sighted users**: Zero awareness of accessibility changes
- **Screen reader users**: Full access to all functionality
- **Keyboard users**: Complete navigation without mouse
- **All users**: Identical performance and functionality

### **Technical Goals**
- 100% of interactive elements have accessible names
- 100% of forms have proper labels and error handling
- 100% of dynamic content has appropriate announcements
- Zero visual regression from accessibility implementations

## Emergency Rollback Plan

If any accessibility change causes issues for sighted users:

1. **Immediate rollback** of the problematic change
2. **Root cause analysis** to understand the visual impact
3. **Alternative implementation** that maintains invisibility
4. **Additional testing** before re-deployment

**Remember: Accessibility is about addition, not subtraction. If it changes the sighted user experience, we're doing it wrong.**

## Audio Interface Accessibility Requirements

### **Critical: Microphone Status Announcements**

The chatbot uses voice interaction, making microphone accessibility critical for blind users.

#### **The Problem:**
- **Sighted users:** See visual mic icon on blue orb → understand it's clickable mic control
- **Blind users:** Hear AI response → try to speak → nothing happens (mic muted by default)
- **Missing:** No announcement about mic status or how to unmute

#### **Required Implementation:**

##### **Connection Status Live Region:**
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {connectionState === 'connected' && !isPreparing && 
    'Connected to RiseTwice AI. Your microphone is muted - click the microphone control in the center of the screen to unmute and start talking.'}
</div>
```

##### **Microphone Control Labeling:**
```tsx
<div 
  className="visualization-container" 
  role="button" 
  aria-label="Microphone control - click to mute or unmute your microphone"
  aria-describedby="mic-description"
>
  <AudioOrbV15 isFunctionExecuting={isFunctionExecuting} />
  <div id="mic-description" className="sr-only">
    Microphone control button located in the center of the screen. 
    Click to toggle your microphone on or off. 
    Visual indicator shows blue animation when AI is speaking.
  </div>
</div>
```

##### **Mute Status Changes:**
```tsx
// Add live region for mute status changes
<div aria-live="polite" className="sr-only">
  {isMuted ? 'Microphone muted' : 'Microphone unmuted - you can now speak'}
</div>
```

### **Interface Description Rules:**

#### **❌ Avoid Confusing Terms:**
- "Audio visualization" - too vague
- "Blue orb" - describes appearance, not function
- "Click somewhere to unmute" - no location guidance

#### **✅ Use Clear, Functional Descriptions:**
- "Microphone control" - describes actual function
- "Center of the screen" - clear location reference
- "Click to mute or unmute your microphone" - explicit action

#### **Location Description Guidelines:**

**For the microphone control:**
- **Primary:** "Center of the screen"
- **Alternative:** "Center bottom area of the screen"
- **Context:** "Microphone control button"

**Why this works:**
- Screen readers can navigate to center of interface
- "Control" indicates it's interactive
- "Microphone" is functionally accurate
- Location is relative to screen, not other elements

### **Testing Requirements:**

#### **Screen Reader User Flow:**
1. Click "Let's Talk" → Hear connection announcement with mic instructions
2. Navigate to center → Find microphone control
3. Click control → Hear mute status change
4. Speak → Confirm AI responds to voice input
5. Click again → Hear mute confirmation

#### **Success Criteria:**
- ✅ User knows mic is muted on connection
- ✅ User knows where to find mic control
- ✅ User knows how to toggle mic status
- ✅ User receives confirmation of status changes
- ✅ User can successfully use voice interaction