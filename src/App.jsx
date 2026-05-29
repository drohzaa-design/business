import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Download,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Trash2,
  Upload
} from "lucide-react";

const moneyFormat = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0
});

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "transactions", label: "รายการเงิน", icon: ReceiptText },
  { id: "projects", label: "โปรเจกต์", icon: BriefcaseBusiness },
  { id: "businesses", label: "ธุรกิจ", icon: Building2 },
  { id: "settings", label: "ตั้งค่า", icon: Settings }
];

function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function localMonth() {
  return localDate().slice(0, 7);
}

function formatMoney(value) {
  return moneyFormat.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function typeLabel(type) {
  return type === "income" ? "รายรับ" : "รายจ่าย";
}

function statusLabel(item) {
  if (item.status === "pending") {
    return item.type === "income" ? "ค้างรับ" : "ค้างจ่าย";
  }
  return item.type === "income" ? "รับแล้ว" : "จ่ายแล้ว";
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: isFormData
      ? options.headers
      : {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
  });

  if (!response.ok) {
    let message = "เกิดข้อผิดพลาด";
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

const emptyTransaction = {
  type: "income",
  amount: "",
  businessId: "",
  categoryId: "",
  date: localDate(),
  status: "paid",
  projectId: "",
  customer: "",
  paymentMethod: "",
  note: "",
  receipt: null
};

const emptyProject = {
  name: "",
  businessId: "",
  customer: "",
  budget: "",
  startDate: localDate(),
  notes: ""
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(localMonth());
  const [businesses, setBusinesses] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    profit: 0,
    receivable: 0,
    payable: 0
  });
  const [recent, setRecent] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then((payload) => setUser(payload.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  async function loadData() {
    if (!user) return;
    setDataLoading(true);
    setError("");
    const query = new URLSearchParams({
      businessId: selectedBusinessId,
      month: selectedMonth
    });

    try {
      const [businessPayload, typePayload, categoryPayload, projectPayload, txPayload, summaryPayload] =
        await Promise.all([
          api("/api/businesses"),
          api("/api/business-types"),
          api("/api/categories?businessId=all"),
          api("/api/projects?businessId=all"),
          api(`/api/transactions?${query}`),
          api(`/api/summary?${query}`)
        ]);

      setBusinesses(businessPayload.businesses);
      setBusinessTypes(typePayload.types);
      setCategories(categoryPayload.categories);
      setProjects(projectPayload.projects);
      setTransactions(txPayload.transactions);
      setSummary(summaryPayload.summary);
      setRecent(summaryPayload.recent);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user, selectedBusinessId, selectedMonth]);

  const selectedBusinessName = useMemo(() => {
    if (selectedBusinessId === "all") return "ทุกธุรกิจ";
    return (
      businesses.find((business) => business.id === selectedBusinessId)?.name ||
      "ทุกธุรกิจ"
    );
  }, [businesses, selectedBusinessId]);

  if (authLoading) {
    return <FullScreenMessage text="กำลังเปิดระบบ..." />;
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  const exportUrl = `/api/export/transactions?${new URLSearchParams({
    businessId: selectedBusinessId,
    month: selectedMonth
  })}`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">฿</div>
          <div>
            <strong>บันทึกเงินธุรกิจ</strong>
            <span>{user.name}</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(item.id)}
              type="button"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{selectedBusinessName}</p>
            <h1>{navItems.find((item) => item.id === page)?.label}</h1>
          </div>
          <FilterBar
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            selectedMonth={selectedMonth}
            onBusinessChange={setSelectedBusinessId}
            onMonthChange={setSelectedMonth}
          />
        </header>

        {notice ? <div className="notice success">{notice}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
        {dataLoading ? <div className="loading-line">กำลังอัปเดตข้อมูล...</div> : null}

        {page === "dashboard" ? (
          <Dashboard
            summary={summary}
            recent={recent}
            onAddClick={() => setPage("transactions")}
          />
        ) : null}

        {page === "transactions" ? (
          <TransactionsPage
            businesses={businesses}
            categories={categories}
            projects={projects}
            transactions={transactions}
            selectedBusinessId={selectedBusinessId}
            exportUrl={exportUrl}
            onCreated={async () => {
              setNotice("บันทึกรายการแล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onDeleted={async (id) => {
              await api(`/api/transactions/${id}`, { method: "DELETE" });
              setNotice("ลบรายการแล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onError={setError}
          />
        ) : null}

        {page === "projects" ? (
          <ProjectsPage
            businesses={businesses}
            projects={projects}
            transactions={transactions}
            selectedBusinessId={selectedBusinessId}
            onCreated={async () => {
              setNotice("เพิ่มโปรเจกต์แล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onError={setError}
          />
        ) : null}

        {page === "businesses" ? (
          <BusinessesPage
            businesses={businesses}
            businessTypes={businessTypes}
            categories={categories}
            onBusinessCreated={async () => {
              setNotice("เพิ่มธุรกิจแล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onCategoryCreated={async () => {
              setNotice("เพิ่มหมวดหมู่แล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onCategoryDeleted={async () => {
              setNotice("ลบหมวดหมู่แล้ว");
              await loadData();
              window.setTimeout(() => setNotice(""), 2200);
            }}
            onError={setError}
          />
        ) : null}

        {page === "settings" ? (
          <SettingsPage
            user={user}
            onLogout={async () => {
              await api("/api/auth/logout", { method: "POST" });
              setUser(null);
            }}
          />
        ) : null}
      </main>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "mobile-nav-item active" : "mobile-nav-item"}
            onClick={() => setPage(item.id)}
            type="button"
            aria-label={item.label}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function FullScreenMessage({ text }) {
  return (
    <div className="full-screen">
      <div className="brand-mark large">฿</div>
      <p>{text}</p>
    </div>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    registrationCode: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = await api(path, {
        method: "POST",
        body: JSON.stringify(form)
      });
      onAuth(payload.user);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <div className="brand-mark">฿</div>
          <div>
            <strong>บันทึกเงินธุรกิจ</strong>
            <span>รายรับ รายจ่าย โปรเจกต์ ธุรกิจ</span>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            เข้าสู่ระบบ
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            สมัครใช้งาน
          </button>
        </div>

        <form className="stack-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              ชื่อ
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label>
            อีเมล
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              autoComplete="email"
              required
            />
          </label>

          <label>
            รหัสผ่าน
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {mode === "register" ? (
            <label>
              รหัสสมัครใช้งาน
              <input
                value={form.registrationCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    registrationCode: event.target.value
                  }))
                }
                placeholder="ใส่เฉพาะตอนระบบตั้งรหัสไว้"
              />
            </label>
          ) : null}

          {error ? <div className="notice error">{error}</div> : null}

          <button className="primary-button full" disabled={loading} type="submit">
            {loading ? "กำลังบันทึก..." : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
          </button>
        </form>
      </section>
    </main>
  );
}

function FilterBar({
  businesses,
  selectedBusinessId,
  selectedMonth,
  onBusinessChange,
  onMonthChange
}) {
  return (
    <div className="filter-bar">
      <label>
        <span>ธุรกิจ</span>
        <select
          value={selectedBusinessId}
          onChange={(event) => onBusinessChange(event.target.value)}
        >
          <option value="all">ทุกธุรกิจ</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>เดือน</span>
        <input
          type="month"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function Dashboard({ summary, recent, onAddClick }) {
  return (
    <div className="page-stack">
      <section className="metric-grid">
        <MetricCard label="รายรับเดือนนี้" value={summary.income} tone="income" />
        <MetricCard label="รายจ่ายเดือนนี้" value={summary.expense} tone="expense" />
        <MetricCard label="กำไร / ขาดทุน" value={summary.profit} tone="profit" />
        <MetricCard label="เงินค้างรับ" value={summary.receivable} tone="pending" />
        <MetricCard label="เงินค้างจ่าย" value={summary.payable} tone="payable" />
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">ล่าสุด</p>
            <h2>รายการเงิน</h2>
          </div>
          <button className="primary-button" onClick={onAddClick} type="button">
            <Plus size={18} />
            เพิ่มรายการ
          </button>
        </div>
        <CompactTransactionList transactions={recent} />
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  const isNegative = Number(value) < 0;
  return (
    <article className={`metric-card ${tone} ${isNegative ? "negative" : ""}`}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </article>
  );
}

function TransactionsPage({
  businesses,
  categories,
  projects,
  transactions,
  selectedBusinessId,
  exportUrl,
  onCreated,
  onDeleted,
  onError
}) {
  return (
    <div className="page-stack">
      <TransactionForm
        businesses={businesses}
        categories={categories}
        projects={projects}
        selectedBusinessId={selectedBusinessId}
        onCreated={onCreated}
        onError={onError}
      />

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">ประจำเดือน</p>
            <h2>รายการทั้งหมด</h2>
          </div>
          <a className="secondary-button" href={exportUrl}>
            <Download size={18} />
            Export CSV
          </a>
        </div>
        <TransactionList transactions={transactions} onDeleted={onDeleted} />
      </section>
    </div>
  );
}

function TransactionForm({
  businesses,
  categories,
  projects,
  selectedBusinessId,
  onCreated,
  onError
}) {
  const [form, setForm] = useState(emptyTransaction);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const defaultBusinessId = useMemo(() => {
    if (selectedBusinessId !== "all") return selectedBusinessId;
    return businesses[0]?.id || "";
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    if (!form.businessId && defaultBusinessId) {
      setForm((current) => ({ ...current, businessId: defaultBusinessId }));
    }
  }, [defaultBusinessId, form.businessId]);

  const businessCategories = categories.filter(
    (category) =>
      category.business_id === form.businessId && category.kind === form.type
  );
  const businessProjects = projects.filter(
    (project) => project.business_id === form.businessId
  );

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    onError("");

    try {
      const payload = new FormData();
      payload.append("type", form.type);
      payload.append("amount", form.amount);
      payload.append("businessId", form.businessId);
      payload.append("categoryId", form.categoryId);
      payload.append("date", form.date);
      payload.append("status", form.status);
      payload.append("projectId", form.projectId);
      payload.append("customer", form.customer);
      payload.append("paymentMethod", form.paymentMethod);
      payload.append("note", form.note);
      if (form.receipt) {
        payload.append("receipt", form.receipt);
      }

      await api("/api/transactions", {
        method: "POST",
        body: payload
      });

      setForm((current) => ({
        ...emptyTransaction,
        type: current.type,
        businessId: current.businessId,
        categoryId: current.categoryId,
        date: localDate()
      }));
      setDetailsOpen(false);
      setFileKey((current) => current + 1);
      await onCreated();
    } catch (submitError) {
      onError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface">
      <div className="section-head">
        <div>
          <p className="eyebrow">เพิ่มเร็ว</p>
          <h2>บันทึกรายรับรายจ่าย</h2>
        </div>
      </div>

      <form className="transaction-form" onSubmit={submit}>
        <div className="type-switch" role="radiogroup" aria-label="ประเภทรายการ">
          <button
            className={form.type === "income" ? "active income" : ""}
            onClick={() =>
              setForm((current) => ({
                ...current,
                type: "income",
                categoryId: "",
                status: "paid"
              }))
            }
            type="button"
          >
            รายรับ
          </button>
          <button
            className={form.type === "expense" ? "active expense" : ""}
            onClick={() =>
              setForm((current) => ({
                ...current,
                type: "expense",
                categoryId: "",
                status: "paid"
              }))
            }
            type="button"
          >
            รายจ่าย
          </button>
        </div>

        <div className="quick-grid">
          <label>
            จำนวนเงิน
            <input
              className="money-input"
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="0"
              required
            />
          </label>

          <label>
            ธุรกิจ
            <select
              value={form.businessId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  businessId: event.target.value,
                  categoryId: "",
                  projectId: ""
                }))
              }
              required
            >
              <option value="">เลือกธุรกิจ</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            หมวดหมู่
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">ไม่ระบุ</option>
              {businessCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            วันที่
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </label>
        </div>

        <button
          className="text-button"
          onClick={() => setDetailsOpen((current) => !current)}
          type="button"
        >
          รายละเอียดเพิ่มเติม
          <ChevronDown className={detailsOpen ? "rotate" : ""} size={18} />
        </button>

        {detailsOpen ? (
          <div className="details-grid">
            <label>
              โปรเจกต์
              <select
                value={form.projectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    projectId: event.target.value
                  }))
                }
              >
                <option value="">ไม่ผูกโปรเจกต์</option>
                {businessProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              สถานะ
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="paid">
                  {form.type === "income" ? "รับแล้ว" : "จ่ายแล้ว"}
                </option>
                <option value="pending">
                  {form.type === "income" ? "ค้างรับ" : "ค้างจ่าย"}
                </option>
              </select>
            </label>

            <label>
              ลูกค้า / ผู้ขาย
              <input
                value={form.customer}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customer: event.target.value }))
                }
              />
            </label>

            <label>
              ช่องทางจ่ายเงิน
              <input
                value={form.paymentMethod}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    paymentMethod: event.target.value
                  }))
                }
                placeholder="โอน, เงินสด, บัตร"
              />
            </label>

            <label className="wide">
              หมายเหตุ
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                rows="3"
              />
            </label>

            <label className="file-input">
              <Upload size={18} />
              <span>{form.receipt ? form.receipt.name : "แนบสลิป / ใบเสร็จ"}</span>
              <input
                key={fileKey}
                accept="image/*,.pdf"
                type="file"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    receipt: event.target.files?.[0] || null
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        <div className="form-actions">
          <button className="primary-button" disabled={saving} type="submit">
            <Plus size={18} />
            {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TransactionList({ transactions, onDeleted }) {
  if (!transactions.length) {
    return <EmptyState text="ยังไม่มีรายการในเดือนนี้" />;
  }

  return (
    <>
      <div className="desktop-table">
        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>รายการ</th>
              <th>ธุรกิจ / โปรเจกต์</th>
              <th>สถานะ</th>
              <th className="right">จำนวนเงิน</th>
              <th>สลิป</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.date)}</td>
                <td>
                  <div className="table-main">
                    <span className={`pill ${item.type}`}>{typeLabel(item.type)}</span>
                    <strong>{item.category_name || "ไม่ระบุหมวดหมู่"}</strong>
                    {item.note ? <small>{item.note}</small> : null}
                  </div>
                </td>
                <td>
                  <div className="table-main">
                    <strong>{item.business_name}</strong>
                    <small>{item.project_name || "-"}</small>
                  </div>
                </td>
                <td>
                  <span className={`status ${item.status}`}>{statusLabel(item)}</span>
                </td>
                <td className={`right amount ${item.type}`}>
                  {item.type === "income" ? "+" : "-"}
                  {formatMoney(item.amount)}
                </td>
                <td>
                  {item.attachment_url ? (
                    <a href={item.attachment_url} target="_blank" rel="noreferrer">
                      เปิด
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="right">
                  <button
                    className="icon-button"
                    onClick={() => onDeleted(item.id)}
                    type="button"
                    aria-label="ลบรายการ"
                  >
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list">
        {transactions.map((item) => (
          <article className="transaction-card" key={item.id}>
            <div>
              <span className={`pill ${item.type}`}>{typeLabel(item.type)}</span>
              <strong>{item.category_name || "ไม่ระบุหมวดหมู่"}</strong>
              <small>
                {formatDate(item.date)} · {item.business_name}
              </small>
              {item.project_name ? <small>{item.project_name}</small> : null}
            </div>
            <div className="card-side">
              <strong className={`amount ${item.type}`}>
                {item.type === "income" ? "+" : "-"}
                {formatMoney(item.amount)}
              </strong>
              <span className={`status ${item.status}`}>{statusLabel(item)}</span>
              <div className="inline-actions">
                {item.attachment_url ? (
                  <a href={item.attachment_url} target="_blank" rel="noreferrer">
                    สลิป
                  </a>
                ) : null}
                <button
                  className="icon-button"
                  onClick={() => onDeleted(item.id)}
                  type="button"
                  aria-label="ลบรายการ"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function CompactTransactionList({ transactions }) {
  if (!transactions.length) {
    return <EmptyState text="ยังไม่มีรายการล่าสุด" />;
  }

  return (
    <div className="compact-list">
      {transactions.map((item) => (
        <div className="compact-row" key={item.id}>
          <div>
            <span className={`pill ${item.type}`}>{typeLabel(item.type)}</span>
            <strong>{item.category_name || "ไม่ระบุหมวดหมู่"}</strong>
            <small>
              {formatDate(item.date)} · {item.business_name}
            </small>
          </div>
          <strong className={`amount ${item.type}`}>
            {item.type === "income" ? "+" : "-"}
            {formatMoney(item.amount)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ProjectsPage({
  businesses,
  projects,
  transactions,
  selectedBusinessId,
  onCreated,
  onError
}) {
  const [form, setForm] = useState(emptyProject);
  const [saving, setSaving] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const defaultBusinessId = useMemo(() => {
    if (selectedBusinessId !== "all") return selectedBusinessId;
    return businesses[0]?.id || "";
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    if (!form.businessId && defaultBusinessId) {
      setForm((current) => ({ ...current, businessId: defaultBusinessId }));
    }
  }, [defaultBusinessId, form.businessId]);

  const visibleProjects = projects.filter((project) =>
    selectedBusinessId === "all" ? true : project.business_id === selectedBusinessId
  );

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    onError("");

    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm((current) => ({
        ...emptyProject,
        businessId: current.businessId,
        startDate: localDate()
      }));
      await onCreated();
    } catch (projectError) {
      onError(projectError.message);
    } finally {
      setSaving(false);
    }
  }

  async function openProject(projectId) {
    if (activeProject?.project?.id === projectId) {
      setActiveProject(null);
      return;
    }

    setDetailLoading(true);
    onError("");
    try {
      const payload = await api(`/api/projects/${projectId}`);
      setActiveProject(payload);
    } catch (projectError) {
      onError(projectError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">เพิ่มโปรเจกต์</p>
            <h2>งานใหม่</h2>
          </div>
        </div>
        <form className="project-form" onSubmit={submit}>
          <label>
            ชื่อโปรเจกต์
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="เช่น บ้านลูกค้า A, บ้านลาดพร้าว"
              required
            />
          </label>
          <label>
            ธุรกิจ
            <select
              value={form.businessId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  businessId: event.target.value
                }))
              }
              required
            >
              <option value="">เลือกธุรกิจ</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            งบประมาณ
            <input
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
              value={form.budget}
              onChange={(event) =>
                setForm((current) => ({ ...current, budget: event.target.value }))
              }
              placeholder="0"
            />
          </label>
          <label>
            ลูกค้า / ทรัพย์
            <input
              value={form.customer}
              onChange={(event) =>
                setForm((current) => ({ ...current, customer: event.target.value }))
              }
            />
          </label>
          <label>
            วันที่เริ่ม
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <button className="primary-button align-end" disabled={saving} type="submit">
            <Plus size={18} />
            {saving ? "กำลังบันทึก..." : "เพิ่มโปรเจกต์"}
          </button>
        </form>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">ภาพรวม</p>
            <h2>โปรเจกต์ทั้งหมด</h2>
          </div>
        </div>
        {visibleProjects.length ? (
          <div className="project-grid">
            {visibleProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-title">
                  <div>
                    <strong>{project.name}</strong>
                    <small>{project.business_name}</small>
                  </div>
                  {project.over_budget ? (
                    <span className="status pending">เกินงบ</span>
                  ) : (
                    <span className="status paid">ในงบ</span>
                  )}
                </div>
                <div className="project-numbers">
                  <span>
                    รับแล้ว
                    <strong>{formatMoney(project.received)}</strong>
                  </span>
                  <span>
                    จ่ายแล้ว
                    <strong>{formatMoney(project.spent)}</strong>
                  </span>
                  <span>
                    กำไร
                    <strong
                      className={project.profit < 0 ? "amount expense" : "amount income"}
                    >
                      {formatMoney(project.profit)}
                    </strong>
                  </span>
                  <span>
                    งบ
                    <strong>{formatMoney(project.budget)}</strong>
                  </span>
                </div>
                <button
                  className="secondary-button full"
                  onClick={() => openProject(project.id)}
                  type="button"
                >
                  ดูรายการเงิน
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState text="ยังไม่มีโปรเจกต์" />
        )}
      </section>

      {detailLoading ? <div className="loading-line">กำลังเปิดโปรเจกต์...</div> : null}
      {activeProject ? (
        <section className="surface">
          <div className="section-head">
            <div>
              <p className="eyebrow">{activeProject.project.business_name}</p>
              <h2>{activeProject.project.name}</h2>
            </div>
          </div>
          <div className="metric-grid compact">
            <MetricCard label="รับแล้ว" value={activeProject.project.received} tone="income" />
            <MetricCard label="จ่ายแล้ว" value={activeProject.project.spent} tone="expense" />
            <MetricCard label="กำไร" value={activeProject.project.profit} tone="profit" />
            <MetricCard label="งบประมาณ" value={activeProject.project.budget} tone="pending" />
          </div>
          <CompactTransactionList transactions={activeProject.transactions} />
        </section>
      ) : null}
    </div>
  );
}

function BusinessesPage({
  businesses,
  businessTypes,
  categories,
  onBusinessCreated,
  onCategoryCreated,
  onCategoryDeleted,
  onError
}) {
  const [form, setForm] = useState({
    name: "",
    type: "general"
  });
  const [categoryForm, setCategoryForm] = useState({
    businessId: "",
    kind: "income",
    name: ""
  });
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    if (!categoryForm.businessId && businesses[0]?.id) {
      setCategoryForm((current) => ({
        ...current,
        businessId: businesses[0].id
      }));
    }
  }, [businesses, categoryForm.businessId]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    onError("");

    try {
      await api("/api/businesses", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ name: "", type: "general" });
      await onBusinessCreated();
    } catch (businessError) {
      onError(businessError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    setSavingCategory(true);
    onError("");

    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify(categoryForm)
      });
      setCategoryForm((current) => ({ ...current, name: "" }));
      await onCategoryCreated();
    } catch (categoryError) {
      onError(categoryError.message);
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(category) {
    const ok = window.confirm(`ลบหมวดหมู่ "${category.name}" ใช่ไหม?`);
    if (!ok) return;

    onError("");
    try {
      await api(`/api/categories/${category.id}`, { method: "DELETE" });
      await onCategoryDeleted();
    } catch (categoryError) {
      onError(categoryError.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">เพิ่มธุรกิจ</p>
            <h2>ธุรกิจใหม่</h2>
          </div>
        </div>
        <form className="business-form" onSubmit={submit}>
          <label>
            1. ชื่อธุรกิจ
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="เช่น ร้านวัสดุ, บ้านเช่า"
              required
            />
          </label>
          <label>
            2. ประเภทธุรกิจ
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({ ...current, type: event.target.value }))
              }
            >
              {businessTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button align-end" disabled={saving} type="submit">
            <Plus size={18} />
            {saving ? "กำลังสร้าง..." : "สร้างธุรกิจ"}
          </button>
        </form>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">เพิ่มหมวดหมู่</p>
            <h2>ใช้ในฟอร์มรายการเงิน</h2>
          </div>
        </div>
        <form className="category-form" onSubmit={submitCategory}>
          <label>
            ธุรกิจ
            <select
              value={categoryForm.businessId}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  businessId: event.target.value
                }))
              }
              required
            >
              <option value="">เลือกธุรกิจ</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ประเภท
            <select
              value={categoryForm.kind}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  kind: event.target.value
                }))
              }
            >
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
          </label>
          <label>
            ชื่อหมวดหมู่
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="เช่น ค่าโฆษณา, ค่าประกันงาน"
              required
            />
          </label>
          <button
            className="primary-button align-end"
            disabled={savingCategory}
            type="submit"
          >
            <Plus size={18} />
            {savingCategory ? "กำลังเพิ่ม..." : "เพิ่มหมวดหมู่"}
          </button>
        </form>
      </section>

      <section className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">ทั้งหมด</p>
            <h2>ธุรกิจของฉัน</h2>
          </div>
        </div>
        <div className="business-grid">
          {businesses.map((business) => {
            const businessCategories = categories.filter(
              (category) => category.business_id === business.id
            );
            const incomeCategories = businessCategories.filter(
              (category) => category.kind === "income"
            );
            const expenseCategories = businessCategories.filter(
              (category) => category.kind === "expense"
            );
            return (
              <article className="business-card" key={business.id}>
                <div>
                  <strong>{business.name}</strong>
                  <small>{businessTypes.find((type) => type.value === business.type)?.label}</small>
                </div>
                <div className="business-stats">
                  <span>{business.project_count} โปรเจกต์</span>
                  <span>{business.transaction_count} รายการ</span>
                </div>
                <CategoryGroup
                  label="รายรับ"
                  categories={incomeCategories}
                  onDelete={deleteCategory}
                />
                <CategoryGroup
                  label="รายจ่าย"
                  categories={expenseCategories}
                  onDelete={deleteCategory}
                />
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CategoryGroup({ label, categories, onDelete }) {
  if (!categories.length) return null;

  return (
    <div className="category-group">
      <small>{label}</small>
      <div className="category-preview">
        {categories.map((category) => (
          <span key={category.id} className={`category-chip ${category.kind}`}>
            <span>{category.name}</span>
            <button
              aria-label={`ลบหมวดหมู่ ${category.name}`}
              onClick={() => onDelete(category)}
              title="ลบหมวดหมู่"
              type="button"
            >
              <Trash2 size={13} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ user, onLogout }) {
  return (
    <div className="page-stack">
      <section className="surface narrow">
        <div className="section-head">
          <div>
            <p className="eyebrow">บัญชี</p>
            <h2>{user.name}</h2>
          </div>
          <ShieldCheck className="shield" size={28} />
        </div>
        <div className="settings-list">
          <div>
            <span>อีเมล</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>ข้อมูล</span>
            <strong>แยกตามบัญชีผู้ใช้</strong>
          </div>
        </div>
        <button className="danger-button" onClick={onLogout} type="button">
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </section>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}
