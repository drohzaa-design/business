# Business Income/Expense Tracker MVP

MVP scaffold using Next.js App Router + TypeScript + Tailwind + Supabase-ready SQL schema.

## What is included
- App navigation and Thai-first pages: Dashboard, รายการเงิน, โปรเจกต์, ธุรกิจ, ตั้งค่า
- Reusable UI building blocks (`StatCard`, `EmptyState`, `AppShell`)
- Supabase migration with multi-business schema, indexes, RLS, constraints
- Seed function skeleton for default businesses + default account

## Next steps (to reach production)
1. Connect Supabase clients and auth middleware.
2. Implement full CRUD server actions with Zod validation.
3. Complete seed categories for business templates.
4. Implement Recharts data queries + CSV export + Storage attachments.
5. Add shadcn/ui components and complete responsive forms.

## Run
```bash
npm install
npm run dev
```
