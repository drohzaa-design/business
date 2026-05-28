import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";
export default function ProjectsPage(){return <AppShell title="โปรเจกต์"><div className="mb-4"><button className="rounded-lg bg-slate-900 px-4 py-2 text-white">+ โปรเจกต์</button></div><div className="rounded-xl bg-white p-4 shadow">Project list (ชื่อ, ธุรกิจ, สถานะ, รายรับ, รายจ่าย, กำไรสุทธิ)</div><Link className="mt-4 block text-blue-600" href="/projects/demo">ดูตัวอย่างรายละเอียดโปรเจกต์</Link></AppShell>}
