# 🤖 Adel RRC - AI Agent Instructions

## 🏗 Project Architecture
- **Framework**: React 19 + Vite.
- **Routing**: React Router v7 (`react-router-dom`).
- **Backend**: Firebase v12 (Authentication & Firestore).
- **Styling**: Component-specific CSS (e.g., `Login.jsx` imports `Login.css`) + Global styles in [src/index.css](src/index.css).
- **Key Files**:
  - [src/main.jsx](src/main.jsx) (Entry point)
  - [src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx) (Auth logic)
  - [src/App.jsx](src/App.jsx) (Routes & Role definitions)

## 🔐 Auth & Roles (Critical)
- **Role System**: strictly enforced via `PrivateRoute`.
  - `sirket_yoneticisi` (Admin - Full Access)
  - `sube_yoneticisi` (Branch Manager - Branch scoped)
  - `personel` (Staff - Operational access)
  - `kurye` (Courier - Task specific)
- **Context Usage**: `const { currentUser, userRole } = useAuth()`. `currentUser` object includes flattened `role`, `subeId`, and `subeAdi`.

## 💾 Firestore Data Patterns
- **Querying**:
  - **Orders (`Adisyonlar`)**: Real-time `onSnapshot` is preferred.
  - **Field Mismatch**: `users` collection uses `subeId`, but `Adisyonlar` collection uses `rrc_restaurant_id`. **ALWAYS verify the field name.**
- **Date Handling**:
  - DB contains mixed formats: ISO (`2025-08-04T10:00...`) and SQL-like (`2025-08-04 10:00...`).
  - **Rule**: Use string comparison for queries (works for both).
  - **Helper**: Use `src/utils/dateUtils.js` for all date formatting/parsing. Do not reinvent date logic.

## 🎨 UI & Design System
- **Global Modal System**:
  - **Strictly** follow the modal pattern in [src/index.css](src/index.css).
  - Classes: `.modal-overlay` (fixed, centered, backdrop) and `.modal-content` (responsive box).
  - Do **NOT** use `!important` or create new overlay logic.
  - Modifiers: `.large-modal`, `.xl-modal`.
- **Responsive Units**: Use `dvh` (dynamic viewport height) for full-height elements to support mobile browsers properly.

## 🧪 Testing & Workflow
- **Manual Testing & Data**: Refer to [test-data-setup.md](test-data-setup.md) for creating test entities (e.g., `giderKalemleri`).
- **Commands**: 
  - `npm run dev` (Start server)
  - `npm run build` (Production build)

## ⚠️ Common Pitfalls
1. **Order Status**: Active=`1`, Paid=`4`. Cancelled orders are identified by `durum` string field containing "IPTAL" (case-insensitive check required).
2. **Missing Utils**: If you need common logic, check `src/utils/` first.
