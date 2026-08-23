# LocalExplorer AI — Mobile Transition & Responsive Design Guide

This guide establishes the architectural standards, UI/UX conventions, and implementation patterns for transitioning desktop (PC) features to ergonomic smartphone experiences in LocalExplorer AI.

---

## 1. Core Architecture & Mental Model

LocalExplorer AI maintains **100% feature parity** across desktop and smartphone environments while adapting layout density and interaction models:

| Dimension | Desktop (PC) Pattern | Smartphone (Mobile) Pattern |
| :--- | :--- | :--- |
| **Primary Navigation** | Top sticky header with full text labels and action icons. | Compact header + Persistent Bottom Tab Bar (`BottomNav.tsx`) with safe-area insets. |
| **Modals & Overlays** | Centered floating dialogs (`max-w-2xl sm:rounded-2xl`). | Adaptive Bottom Sheets (`rounded-t-2xl sm:rounded-2xl max-h-[90vh] pb-safe`). |
| **Itinerary Grid** | Multi-column day selectors, side-by-side interactive map. | Single-column swipeable cards, expandable map drawers, sticky bottom actions. |
| **Touch Targets** | 32–36px compact clickable badges. | Minimum 44×44px touch targets with generous tap cushioning. |
| **Form Inputs** | Multi-column grid rows (`grid-cols-2` or `grid-cols-3`). | Single-column stacked fields with clear visual hierarchy. |

---

## 2. Layout & Spacing Tokens

### A. Viewport Padding & Safe Area
* **Mobile Container Padding**: `px-3 py-4` (never exceed `px-4` on mobile to preserve content width).
* **Desktop Container Padding**: `sm:px-6 lg:px-8 py-8`.
* **Bottom Navigation Clearance**: When `BottomNav` is present, the page root must apply `pb-16 md:pb-0` and footers must apply `mb-12 md:mb-0`.
* **iOS Safe Area Inset**: `pb-[env(safe-area-inset-bottom,8px)]`.

### B. Typography Hierarchy
* **App Title**: `text-lg sm:text-2xl font-serif italic truncate`.
* **Section Headers**: `text-base sm:text-xl font-serif font-bold`.
* **Card Titles**: `text-sm sm:text-base font-semibold`.
* **Activity Descriptions / Details**: `text-xs sm:text-sm leading-relaxed text-[#5A5A40]`.
* **Action Badges & Chips**: `text-[10px] sm:text-xs font-medium`.

---

## 3. Responsive Modal & Sheet Pattern

When creating a new modal or preference editor, use this responsive wrapper:

```tsx
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
  <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl border-t sm:border border-[#e5e5df] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
    {/* Header */}
    <div className="p-4 sm:p-5 border-b border-[#e5e5df] flex items-center justify-between shrink-0 bg-[#f5f5f0]/80">
      <h3 className="font-serif text-base sm:text-lg font-bold text-[#2c2c24]">{title}</h3>
      <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#e5e5df] text-[#6b6b5e]">
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Scrollable Content */}
    <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
      {children}
    </div>

    {/* Footer Actions */}
    <div className="p-3 sm:p-4 border-t border-[#e5e5df] bg-[#f5f5f0] flex justify-end space-x-2 shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
      <button onClick={onClose} className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#5A5A40] text-white">
        Done
      </button>
    </div>
  </div>
</div>
```

---

## 4. Worldwide Geocoding & Gemini AI Pipeline

1. **Zero Static Coordinates**: Never hardcode city or coordinate lists. All destinations worldwide resolve through the dynamic OpenStreetMap / Nominatim geocoder (`src/utils/geocoding.ts`).
2. **Model Consistency**: All itinerary and activity prompts use Gemini 3.5 series (`gemini-3.5-flash` / `gemini-3.5-flash-lite`).
3. **Post-AI Translation Flow**:
   - Request and generate AI output in structured English JSON.
   - Cache results in `perfCache`.
   - Run AI output fields through the client-side translator (`translateActivityTexts`) to deliver localized content in English, Spanish, or Basque seamlessly.

---

## 5. Mobile Testing Checklist for New Features

- [ ] **No horizontal overflow** at 360px viewport width (tested in responsive device emulation).
- [ ] **Persistent bottom bar clearance** (buttons and forms are not covered by `BottomNav`).
- [ ] **Touch targets are at least 44px high** for primary interaction buttons.
- [ ] **Modals open as clean bottom-sheets** on `<640px` screens.
- [ ] **Print layouts exclude mobile navigation** using `no-print` classes.
- [ ] **All new static UI labels have translations** in `LanguageContext.tsx` (`en`, `es`, `eu`).
