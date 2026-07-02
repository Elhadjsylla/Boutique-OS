---
name: BoutikOS Design System
colors:
  surface: '#fcf8ff'
  surface-dim: '#dad7f3'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2ff'
  surface-container: '#efecff'
  surface-container-high: '#e8e5ff'
  surface-container-highest: '#e2e0fc'
  on-surface: '#1a1a2e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f2e43'
  inverse-on-surface: '#f2efff'
  outline: '#73777f'
  outline-variant: '#c3c6cf'
  surface-tint: '#416084'
  primary: '#002645'
  on-primary: '#ffffff'
  primary-container: '#1a3c5e'
  on-primary-container: '#87a7ce'
  inverse-primary: '#a9c9f2'
  secondary: '#006d37'
  on-secondary: '#ffffff'
  secondary-container: '#7bf8a1'
  on-secondary-container: '#007239'
  tertiary: '#382000'
  on-tertiary: '#ffffff'
  tertiary-container: '#553300'
  on-tertiary-container: '#e69200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#a9c9f2'
  on-primary-fixed: '#001d36'
  on-primary-fixed-variant: '#28496b'
  secondary-fixed: '#7efba4'
  secondary-fixed-dim: '#61de8a'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#ffddb9'
  tertiary-fixed-dim: '#ffb961'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#663e00'
  background: '#fcf8ff'
  on-background: '#1a1a2e'
  surface-variant: '#e2e0fc'
typography:
  headline-hero:
    fontFamily: DM Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-hero-mobile:
    fontFamily: DM Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-section:
    fontFamily: DM Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-section-mobile:
    fontFamily: DM Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  body-main:
    fontFamily: DM Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  touch-target: 48px
---

## Brand & Style
The design system is engineered for the Pan-African retail landscape, prioritizing reliability, trust, and high-performance utility on Android devices. The brand personality is **Professional & Grounded**, reflecting the seriousness of business management, yet remains **Approachable & Modern** to bridge the gap between traditional trade and digital transformation.

The aesthetic follows a **Corporate Modern** style with a focus on high-clarity interfaces. It balances the stability of deep navy tones with energetic accents that signify growth and success. Every element is designed with a "Mobile-First" and "Offline-First" philosophy, ensuring that the UI remains functional and legible even in challenging lighting conditions or on lower-resolution mobile screens common in the target regions.

## Colors
The palette is rooted in stability and action. 
- **Primary (#1A3C5E):** Used for navigation, headers, and primary branding to evoke trust and authority.
- **Accent/CTA (#27AE60):** Reserved for "Success" states and primary calls to action (Add to Cart, Complete Sale, Confirm).
- **Highlight (#F39C12):** Used sparingly for alerts, pending states, or featured insights to draw attention without causing alarm.
- **Surface & Backgrounds:** The Hero Background (#F5F7FA) provides a soft, low-glare surface for extended use. High-contrast text (#1A1A2E) ensures maximum readability under sunlight.

## Typography
This design system utilizes **DM Sans** for its geometric clarity and exceptional legibility on mobile displays. 
- **Scale:** High contrast between hero titles and body text creates a clear information hierarchy.
- **Android Optimization:** Line heights are slightly generous to prevent crowding on smaller screens. 
- **Localization:** Font weights are selected to remain legible even when translated into longer phrases common in French or local business terminologies.

## Layout & Spacing
The system uses a **Fluid Grid** model optimized for Android's diverse aspect ratios.
- **Mobile Spacing:** A 16px (4-unit) gutter and margin are standard to maximize horizontal real estate while maintaining "thumb-friendly" safe zones.
- **Touch Targets:** All interactive elements maintain a minimum height/width of 48px to accommodate rapid, one-handed input.
- **Offline Indicators:** Layouts must reserve a 24px vertical slot at the top or bottom for persistent "Offline Mode" status banners.

## Elevation & Depth
Visual hierarchy is established through **Tonal Layers** and **Low-Contrast Outlines**.
- **Cards:** Use a subtle border (#E5E7EB) rather than heavy shadows to ensure performance on older hardware. 
- **Active Elevation:** A soft, 8% opacity shadow of the Primary color is used only for active floating action buttons (FAB) or triggered modals.
- **Depth:** Backgrounds use #F5F7FA, while foreground containers (Cards, Inputs) use pure #FFFFFF to create a natural "lifted" effect.

## Shapes
The shape language is mixed to distinguish between structural and actionable elements:
- **Buttons:** 10px radius creates a modern, slightly softened professional look.
- **Cards:** 16px radius offers a friendly, approachable container for data-heavy content.
- **Status Pills:** Fully rounded (999px) to clearly differentiate "tags" or "status" from "actions."

## Components
- **Buttons:** Primary buttons use the Accent Green (#27AE60) with white text. Secondary buttons use the Primary Navy (#1A3C5E) as an outline or solid fill. 10px corner radius applied.
- **Cards:** White background, 16px corner radius, and a 1px border (#E5E7EB). Padding is fixed at 16px or 20px.
- **Pill Badges:** Used for stock status (e.g., "In Stock", "Out of Stock"). Backgrounds are 10% opacity of the status color (Green/Orange/Red) with full-saturation text.
- **Input Fields:** Large 48px height with 10px rounded corners. Borders use #E5E7EB, turning Primary Navy (#1A3C5E) on focus. Labels are persistent to help users remember context during data entry.
- **Bottom Navigation:** A dedicated mobile bar for core functions: Inventory, Sales, Reports, and Profile, optimized for Android navigation gestures.
- **Offline Sync Indicator:** A small, persistent icon or bar that changes color based on local data synchronization status.