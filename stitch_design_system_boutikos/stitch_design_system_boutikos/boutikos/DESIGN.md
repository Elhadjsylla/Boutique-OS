---
name: BoutikOS
colors:
  surface: '#f7f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
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
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
typography:
  headline-lg:
    fontFamily: DM Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: DM Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-display:
    fontFamily: DM Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality is **Professional, Grounded, and Accessible**, striking a balance between the reliability of modern fintech and the efficiency of precision retail tools. It is designed specifically for African merchants who require a high-utility interface that remains legible under varying lighting conditions, including direct sunlight.

The design style is **Corporate / Modern** with a focus on high-contrast clarity and structural stability. Drawing inspiration from Japanese POS systems, the UI prioritizes functional density without clutter. The aesthetic is warm yet disciplined, using soft roundedness to feel approachable while maintaining a strict grid for trust. Avoid all decorative effects like gradients, glassmorphism, or complex blurs to ensure maximum performance on a wide range of mobile hardware.

## Colors
The palette is rooted in a deep **Primary Navy (#1A3C5E)** to convey institutional trust and stability. Actionable feedback is immediate through high-saturation semantic colors: **Success Green** for completed transactions, **Warning Orange** for low stock, and **Danger Red** for stock-outs or errors.

The background uses a cool-toned **Neutral Grey (#F5F7FA)** to reduce eye strain, while the **Surface White (#FFFFFF)** is reserved for interactive cards and input areas to create a clear "layering" effect. High contrast ratios (minimum 4.5:1 for text) must be maintained across all surfaces to ensure readability in outdoor market environments.

## Typography
The typographic system uses **DM Sans** for headings and high-impact data points to provide a modern, friendly character. **Inter** is utilized for all body copy and UI labels to ensure maximum legibility and systematic clarity, especially at the minimum size of 12px.

For financial metrics and inventory counts, use the `numeric-display` style to ensure numbers are distinct and easy to scan. Line heights are generous to prevent visual crowding in data-heavy lists.

## Layout & Spacing
The layout follows a **fluid grid** model with a base-4 tracking system. On mobile devices, a 4-column grid is used with 16px margins; on desktop/tablet, this scales to a 12-column grid.

Spacing is used to group related information: 8px (sm) for internal element spacing within a card, and 16px (md) for the "gutter" between major components. Bottom navigation is fixed to the viewport on mobile to ensure primary actions are always within thumb-reach.

## Elevation & Depth
Depth is communicated through **Tonal Layers** supplemented by **Ambient Shadows**. This design system avoids heavy shadows, opting instead for a single, soft elevation style for interactive elements.

- **Level 0 (Background):** #F5F7FA — The base canvas.
- **Level 1 (Cards/Surfaces):** #FFFFFF — No shadow, defined by a subtle 1px stroke (#E2E8F0) to maintain crispness.
- **Level 2 (Active/Floating):** #FFFFFF — A soft, diffused shadow (0px 4px 12px rgba(26, 60, 94, 0.08)) used for metrics cards and floating buttons.
- **Level 3 (Toasts/Modals):** High-contrast surfaces with a more pronounced shadow (0px 8px 24px rgba(0, 0, 0, 0.12)).

## Shapes
The shape language is defined by **Rounded (0.5rem / 8px)** defaults for standard UI components like input fields and small buttons. However, for primary containers like **Product Cards** and **Metrics Cards**, use `rounded-lg` (16px) to emphasize the "warm and accessible" brand personality. 

Stock badges and avatars use a full-pill radius to distinguish them from structural rectangular elements.

## Components
- **Buttons:** Primary buttons are Solid Navy (#1A3C5E) with white text. Secondary buttons use a Navy outline. All buttons must have a minimum height of 48px for touch accessibility.
- **Product Cards:** Must feature a 16px corner radius, a top-aligned image area, and a prominent **Stock Badge** in the top-right corner using semantic colors (e.g., Green for "In Stock", Red for "Out of Stock").
- **Metrics Cards:** Large-format typography for totals (e.g., Daily Revenue) with a bottom-aligned "Stock Progress Bar" showing inventory health.
- **Stock Progress Bars:** A 4px tall track (#E2E8F0) with a colored fill that changes from Green to Orange as stock levels drop below 20%.
- **Bottom Navigation:** A fixed Navy bar with 24px icons and 12px labels. The active state is indicated by a subtle white vertical indicator or a change in icon opacity.
- **Initial Avatars:** Circular backgrounds using a rotating palette of muted tertiary colors (Teal, Ochre, Rose) with bold white initials.
- **Toast Notifications:** Full-width mobile banners at the top of the screen using semantic background tints and dark text for instant status recognition.