import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function TransactionsPage(){return <AppShell title="รายการเงิน"><div className="mb-4 flex flex-wrap gap-2"><button className="rounded-lg bg-emerald-600 px-4 py-2 text-white">+ รายรับ</button><button className="rounded-lg bg-rose-600 px-4 py-2 text-white">+ รายจ่าย</button></div><EmptyState title="ยังไม่มีรายการเงิน"/></AppShell>}
