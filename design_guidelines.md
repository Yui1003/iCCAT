# iCCAT Smart Campus Kiosk - Design Guidelines

## Design Approach

**Selected Approach:** Material Design System (adapted for kiosk/touch interface)

**Rationale:** This information kiosk requires clear information hierarchy, touch-optimized interactions, and robust component patterns for maps, modals, forms, and data displays. Material Design provides the structure needed for a public-facing utility application while maintaining visual appeal.

**Core Principles:**
- Touch-first interaction design with large tap targets (minimum 48px)
- Clear visual hierarchy for wayfinding and information discovery
- Professional academic aesthetic with approachable warmth
- Immediate comprehension - users should understand functionality at a glance
- Consistent patterns across admin and public-facing interfaces

---

## Typography

**Font Stack:**
- Primary: 'Roboto' (via Google Fonts CDN)
- Monospace: 'Roboto Mono' for codes/room numbers

**Hierarchy:**
- H1 (Landing/Module Titles): 48px/font-bold - Large kiosk-friendly headers
- H2 (Section Headers): 32px/font-semibold - Modal titles, panel headers
- H3 (Subsections): 24px/font-medium - Building names, card titles
- Body Large: 18px/font-normal - Primary content, descriptions
- Body: 16px/font-normal - Secondary text, labels
- Caption: 14px/font-normal - Metadata, timestamps, helper text
- Button Text: 16-18px/font-medium - All-caps for primary actions

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16 (p-2, h-8, m-4, gap-6, etc.)

**Grid Structures:**
- Landing Page: 2-column grid (lg:grid-cols-2) for main action buttons
- Admin Panels: Sidebar (w-64) + main content area (flex-1)
- Staff/Event Cards: 3-column grid (lg:grid-cols-3, md:grid-cols-2, grid-cols-1)
- Floor Plan Editor: Full viewport with floating toolbars

**Container Strategy:**
- Landing: Full viewport sections (min-h-screen)
- Content Modules: max-w-7xl centered containers with px-6 py-8
- Modals: max-w-2xl for information, max-w-4xl for editors, max-w-6xl for maps
- Admin Forms: max-w-xl for optimal form width

**Vertical Rhythm:** py-8 for section padding, py-4 for card interiors, py-2 for tight groupings

---

## Component Library

### Navigation & Landing

**Landing Page Buttons:**
- Large card-style buttons (min-h-40) with icons (64px) above text
- 4-button grid layout with ample spacing (gap-6)
- Elevated appearance with shadow-lg and subtle hover lift
- Icon + Title + Subtitle pattern

**Admin Access Link:**
- Small text link at page bottom (text-sm underline)

### Map Interface

**Map Container:**
- Full height of viewport minus header (h-[calc(100vh-4rem)])
- Leaflet controls positioned top-right with elevated panels
- Building markers: Custom colored pins with building icons
- Selected state: Larger scale + pulsing animation

**Map Controls:**
- Floating white panels (bg-white shadow-lg rounded-lg p-4)
- Positioned absolutely over map
- Z-index layering: Controls (50) > Markers (30) > Base map (10)

### Building Information Modal

**Structure:**
- Draggable modal with header handle
- Image preview area at top (aspect-video)
- Tabbed content: Overview | Staff | Floor Plans
- Fixed footer with action buttons
- Close button (top-right icon)

**Content Layout:**
- Two-column layout for metadata (grid-cols-2 gap-4)
- List views for staff/departments with avatar chips
- Floor preview thumbnails in horizontal scroll

### Navigation System

**Route Display:**
- Colored polyline on map (blue for walking, green for driving, stroke-width: 6)
- Start/end markers with custom icons
- Side panel (w-80) with step-by-step directions
- Each step: Icon + instruction + distance

**Direction Steps:**
- Numbered circles (40px) with step numbers
- Turn icons from Heroicons
- Distance badges on right
- Active step highlighted

### Floor Plan Viewer

**Viewer Interface:**
- Pannable/zoomable canvas (similar to map)
- Room markers as colored circles with labels
- Zoom controls in corner
- Floor selector tabs at top

**Room Markers:**
- Circular badges (w-8 h-8) with room numbers
- Color-coded by type (classroom: blue, office: green, lab: purple)
- Tooltip on hover/tap showing room details
- Click opens room info modal

### Staff Directory

**Search Interface:**
- Prominent search bar (h-12) with icon
- Filter chips below (building, department)
- Real-time results as cards

**Staff Cards:**
- Horizontal layout: Avatar (w-16 h-16 rounded-full) | Info
- Name (text-lg font-semibold)
- Position/Department (text-sm text-gray-600)
- Building/Room (text-sm with location icon)
- Click for detailed modal

### Events & Announcements

**Event Cards:**
- Vertical card layout with image header (aspect-video object-cover)
- Date badge overlaying top-left corner
- Title (text-xl font-semibold)
- Excerpt (3 lines, truncated)
- "Read More" link

**Event Modal:**
- Full event image at top
- Date/time/location metadata row
- Full description with proper paragraph spacing

### Admin Panel

**Layout:**
- Left sidebar (w-64): Navigation menu with icons
- Main content: Contextual editors
- Top bar: Current module title + logout

**Form Components:**
- Label above input pattern
- Input fields (h-12 rounded-lg border-2)
- Grouped fields with gap-4
- Action buttons right-aligned at bottom
- Cancel (ghost) + Save (primary) pattern

**Data Tables:**
- Zebra striping (even:bg-gray-50)
- Action column on right with icon buttons
- Sortable headers with arrow indicators
- Row height: h-16 for touch targets

**Map Editors:**
- Drawing toolbar (top of map)
- Tool buttons in horizontal row
- Active tool state: filled background
- Node handles: draggable circles (w-4 h-4) on paths

### Buttons & Actions

**Primary Button:**
- Solid fill, rounded-lg, px-6 py-3, font-medium
- Touch-friendly minimum size (h-12)
- Elevated with shadow

**Secondary Button:**
- Border-2, rounded-lg, px-6 py-3
- Transparent background

**Icon Buttons:**
- Square (w-12 h-12), rounded-full for floating actions
- Icon centered (w-6 h-6)

**Floating Action Button (FAB):**
- Large circular button (w-16 h-16)
- Fixed position bottom-right
- Shadow-xl with hover lift

### Modals & Overlays

**Modal Backdrop:**
- Semi-transparent overlay (bg-black/50)
- Blur effect (backdrop-blur-sm)

**Modal Container:**
- Centered, elevated card (shadow-2xl)
- Rounded-xl corners
- Padding: p-6
- Slide-up entrance animation

**Toast Notifications:**
- Fixed top-right position
- Auto-dismiss after 3 seconds
- Icon + message + close button
- Slide-in animation

---

## Interaction Patterns

**Touch Optimization:**
- All interactive elements minimum 48x48px
- Increased spacing between clickable items (gap-4 minimum)
- No hover-dependent interactions
- Clear pressed states (scale-95 active state)

**Loading States:**
- Skeleton screens for data loading
- Spinner overlay for map operations
- Progress indicators for file uploads

**Feedback:**
- Immediate visual response to all taps
- Success/error toasts for admin actions
- Inline validation for forms

**Animations:**
- Subtle page transitions (fade/slide)
- Modal entrance: slide-up with fade
- Button press: scale feedback
- Map marker selection: bounce animation
- NO decorative animations - keep functional only

---

## Images

**Landing Page:**
- Background: University campus panorama or iconic building (full viewport, subtle overlay for readability)
- Positioned behind button grid with gradient overlay (from-black/60 to-black/30)

**Building Modals:**
- Building exterior photos (aspect-video) at modal header
- Placeholder: Generic university building silhouette if no image

**Floor Plans:**
- Uploaded architectural floor plan images
- Displayed as pannable/zoomable images

**Staff Photos:**
- Headshot portraits (square, 1:1 ratio)
- Placeholder: Generic avatar icon for missing photos

**Event Cards:**
- Event-specific images (aspect-video, 16:9)
- Placeholder: Calendar icon graphic for events without images

---

This design system creates a professional, highly functional kiosk interface optimized for public use while maintaining the flexibility needed for comprehensive admin tools.