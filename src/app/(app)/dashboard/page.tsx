import { AppShell } from "@/components/shared/app-shell";
import { StatCard } from "@/components/shared/stat-card";

export default function DashboardPage(){
 return <AppShell title="Dashboard"><section className="grid gap-3 md:grid-cols-5"><StatCard label="รายรับเดือนนี้" value="฿0"/><StatCard label="รายจ่ายเดือนนี้" value="฿0"/><StatCard label="กำไรสุทธิเดือนนี้" value="฿0"/><StatCard label="ค้างรับ" value="฿0"/><StatCard label="ค้างจ่าย" value="฿0"/></section><section className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-white p-4 shadow">กราฟรายรับ/รายจ่ายรายเดือน (Recharts)</div><div className="rounded-xl bg-white p-4 shadow">สัดส่วนรายจ่ายตามหมวดหมู่</div><div className="rounded-xl bg-white p-4 shadow md:col-span-2">กำไรตามโปรเจกต์ + รายการล่าสุด</div></section></AppShell>
}
