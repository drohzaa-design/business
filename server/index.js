import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, "data");
const uploadRoot = path.join(dataDir, "uploads");
const dbPath = path.join(dataDir, "app.sqlite");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const COOKIE_NAME = "business_money_session";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "dev-only-change-JWT_SECRET-before-production");
const REGISTRATION_CODE = String(process.env.REGISTRATION_CODE || "").trim();

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required when NODE_ENV=production");
}

fs.mkdirSync(uploadRoot, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const businessTemplates = {
  solar: {
    label: "Solar Cell",
    income: [
      "มัดจำลูกค้า",
      "งวดติดตั้ง",
      "งวดส่งมอบ",
      "ค่าซ่อมบำรุง",
      "รายรับอื่น ๆ"
    ],
    expense: [
      "แผงโซลาร์",
      "Inverter",
      "โครงสร้าง",
      "อุปกรณ์ไฟฟ้า",
      "ค่าแรงติดตั้ง",
      "ค่าเดินทาง",
      "ค่าวิศวกร",
      "ค่าเครื่องมือ",
      "รายจ่ายอื่น ๆ"
    ]
  },
  renovation: {
    label: "รีโนเวทบ้านมือสอง",
    income: ["เงินขายบ้าน", "มัดจำผู้ซื้อ", "ค่าเช่า", "รายรับอื่น ๆ"],
    expense: [
      "ราคาซื้อทรัพย์",
      "ค่าแรงช่าง",
      "ค่าวัสดุ",
      "ค่าเฟอร์นิเจอร์",
      "ค่าขนส่ง",
      "ค่านายหน้า",
      "ค่าการตลาด",
      "ดอกเบี้ย",
      "ค่าธรรมเนียมโอน",
      "รายจ่ายอื่น ๆ"
    ]
  },
  general: {
    label: "ธุรกิจทั่วไป",
    income: ["ขายสินค้า/บริการ", "ค่าบริการ", "รายรับอื่น ๆ"],
    expense: [
      "ต้นทุนสินค้า",
      "ค่าแรง",
      "ค่าเดินทาง",
      "ค่าเช่า",
      "ค่าการตลาด",
      "รายจ่ายอื่น ๆ"
    ]
  },
  blank: {
    label: "เริ่มแบบว่าง",
    income: [],
    expense: []
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    customer TEXT,
    budget REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    project_id TEXT,
    category_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
    customer TEXT,
    note TEXT,
    payment_method TEXT,
    attachment_path TEXT,
    attachment_original_name TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);
  CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(user_id, business_id);
  CREATE INDEX IF NOT EXISTS idx_projects_business ON projects(user_id, business_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions(user_id, business_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(user_id, project_id);
`);

app.use(express.json());
app.use(cookieParser());

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = path.join(uploadRoot, req.user.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).slice(0, 16);
      cb(null, `${randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    cb(allowed ? null : new Error("อัปโหลดได้เฉพาะรูปภาพหรือ PDF"), allowed);
  }
});

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function makeId() {
  return randomUUID();
}

function monthRange(month) {
  const fallback = new Date().toISOString().slice(0, 7);
  const value = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : fallback;
  const [year, monthIndex] = value.split("-").map(Number);
  const start = `${year}-${String(monthIndex).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, monthIndex, 1));
  const end = nextMonth.toISOString().slice(0, 10);
  return { month: value, start, end };
}

function moneyValue(input) {
  const value = Number(input);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies[COOKIE_NAME] || bearer;

  if (!token) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "กรุณาเข้าสู่ระบบอีกครั้ง" });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบอีกครั้ง" });
  }
}

function getOwnedBusiness(userId, businessId) {
  return db
    .prepare("SELECT * FROM businesses WHERE id = ? AND user_id = ?")
    .get(businessId, userId);
}

function getOwnedProject(userId, projectId) {
  return db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId);
}

function getOwnedCategory(userId, categoryId) {
  return db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(categoryId, userId);
}

function createBusinessWithTemplate(userId, name, type) {
  const template = businessTemplates[type] || businessTemplates.general;
  const createdAt = now();
  const businessId = makeId();

  db.prepare(
    `INSERT INTO businesses (id, user_id, name, type, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(businessId, userId, name.trim(), type, createdAt);

  const insertCategory = db.prepare(
    `INSERT INTO categories (id, user_id, business_id, name, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const kind of ["income", "expense"]) {
    for (const categoryName of template[kind]) {
      insertCategory.run(
        makeId(),
        userId,
        businessId,
        categoryName,
        kind,
        createdAt
      );
    }
  }

  return getOwnedBusiness(userId, businessId);
}

const seedInitialBusinesses = db.transaction((userId) => {
  createBusinessWithTemplate(userId, "Solar Cell", "solar");
  createBusinessWithTemplate(userId, "รีโนเวทบ้านมือสอง", "renovation");
});

function businessFilter(req, res) {
  const businessId = req.query.businessId;
  if (!businessId || businessId === "all") return null;

  const business = getOwnedBusiness(req.user.id, businessId);
  if (!business) {
    res.status(404).json({ message: "ไม่พบธุรกิจนี้" });
    return false;
  }

  return businessId;
}

function transactionSelect(whereClause, params) {
  return db
    .prepare(
      `
      SELECT
        t.*,
        b.name AS business_name,
        c.name AS category_name,
        p.name AS project_name
      FROM transactions t
      JOIN businesses b ON b.id = t.business_id
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE ${whereClause}
      ORDER BY t.date DESC, t.created_at DESC
      `
    )
    .all(...params);
}

function serializeTransaction(row) {
  return {
    ...row,
    amount: moneyValue(row.amount),
    attachment_url: row.attachment_path ? `/api/attachments/${row.id}` : null
  };
}

function csvCell(value) {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const registrationCode = String(req.body.registrationCode || "").trim();

  if (!name || !email || password.length < 6) {
    return res.status(400).json({
      message: "กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร"
    });
  }

  if (REGISTRATION_CODE && registrationCode !== REGISTRATION_CODE) {
    return res.status(403).json({ message: "รหัสสมัครใช้งานไม่ถูกต้อง" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ message: "อีเมลนี้ถูกใช้แล้ว" });
  }

  const user = {
    id: makeId(),
    name,
    email,
    password_hash: await bcrypt.hash(password, 12),
    created_at: now()
  };

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, created_at)
     VALUES (@id, @name, @email, @password_hash, @created_at)`
  ).run(user);
  seedInitialBusinesses(user.id);
  setAuthCookie(res, user);
  res.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  setAuthCookie(res, user);
  res.json({ user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/business-types", requireAuth, (_req, res) => {
  res.json({
    types: Object.entries(businessTemplates).map(([value, template]) => ({
      value,
      label: template.label
    }))
  });
});

app.get("/api/businesses", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        b.*,
        COUNT(DISTINCT p.id) AS project_count,
        COUNT(DISTINCT t.id) AS transaction_count
      FROM businesses b
      LEFT JOIN projects p ON p.business_id = b.id AND p.user_id = b.user_id
      LEFT JOIN transactions t ON t.business_id = b.id AND t.user_id = b.user_id
      WHERE b.user_id = ?
      GROUP BY b.id
      ORDER BY b.created_at ASC
      `
    )
    .all(req.user.id);

  res.json({ businesses: rows });
});

app.post("/api/businesses", requireAuth, (req, res) => {
  const name = String(req.body.name || "").trim();
  const type = String(req.body.type || "general");

  if (!name) {
    return res.status(400).json({ message: "กรุณาใส่ชื่อธุรกิจ" });
  }

  const business = createBusinessWithTemplate(req.user.id, name, type);
  const categories = db
    .prepare("SELECT * FROM categories WHERE user_id = ? AND business_id = ?")
    .all(req.user.id, business.id);

  res.status(201).json({ business, categories });
});

app.get("/api/categories", requireAuth, (req, res) => {
  const businessId = businessFilter(req, res);
  if (businessId === false) return;

  const where = ["user_id = ?"];
  const params = [req.user.id];
  if (businessId) {
    where.push("business_id = ?");
    params.push(businessId);
  }

  const categories = db
    .prepare(
      `SELECT * FROM categories WHERE ${where.join(
        " AND "
      )} ORDER BY kind ASC, created_at ASC`
    )
    .all(...params);
  res.json({ categories });
});

app.post("/api/categories", requireAuth, (req, res) => {
  const businessId = String(req.body.businessId || "");
  const kind = String(req.body.kind || "");
  const name = String(req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "กรุณาใส่ชื่อหมวดหมู่" });
  }

  if (!["income", "expense"].includes(kind)) {
    return res.status(400).json({ message: "กรุณาเลือกประเภทรายรับหรือรายจ่าย" });
  }

  const business = getOwnedBusiness(req.user.id, businessId);
  if (!business) {
    return res.status(400).json({ message: "กรุณาเลือกธุรกิจ" });
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM categories
       WHERE user_id = ? AND business_id = ? AND kind = ? AND lower(name) = lower(?)`
    )
    .get(req.user.id, businessId, kind, name);

  if (duplicate) {
    return res.status(409).json({ message: "มีหมวดหมู่นี้อยู่แล้ว" });
  }

  const category = {
    id: makeId(),
    user_id: req.user.id,
    business_id: businessId,
    name,
    kind,
    created_at: now()
  };

  db.prepare(
    `INSERT INTO categories (id, user_id, business_id, name, kind, created_at)
     VALUES (@id, @user_id, @business_id, @name, @kind, @created_at)`
  ).run(category);

  res.status(201).json({ category });
});

app.delete("/api/categories/:id", requireAuth, (req, res) => {
  const category = getOwnedCategory(req.user.id, req.params.id);

  if (!category) {
    return res.status(404).json({ message: "ไม่พบหมวดหมู่นี้" });
  }

  const transactionCount = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE user_id = ? AND category_id = ?")
    .get(req.user.id, category.id).count;

  if (transactionCount > 0) {
    return res.status(409).json({
      message:
        "หมวดหมู่นี้ถูกใช้ในรายการเงินแล้ว จึงลบไม่ได้เพื่อไม่ให้ข้อมูลเก่าสับสน"
    });
  }

  db.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?").run(
    category.id,
    req.user.id
  );

  res.json({ ok: true });
});

app.get("/api/summary", requireAuth, (req, res) => {
  const businessId = businessFilter(req, res);
  if (businessId === false) return;

  const { month, start, end } = monthRange(req.query.month);
  const where = ["user_id = ?", "date >= ?", "date < ?"];
  const params = [req.user.id, start, end];
  const recentWhere = ["t.user_id = ?", "t.date >= ?", "t.date < ?"];
  const recentParams = [req.user.id, start, end];

  if (businessId) {
    where.push("business_id = ?");
    params.push(businessId);
    recentWhere.push("t.business_id = ?");
    recentParams.push(businessId);
  }

  const summary = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount ELSE 0 END), 0) AS receivable,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount ELSE 0 END), 0) AS payable
      FROM transactions
      WHERE ${where.join(" AND ")}
      `
    )
    .get(...params);

  const recent = transactionSelect(recentWhere.join(" AND "), recentParams)
    .slice(0, 6)
    .map(serializeTransaction);

  res.json({
    month,
    summary: {
      income: moneyValue(summary.income),
      expense: moneyValue(summary.expense),
      profit: moneyValue(summary.income - summary.expense),
      receivable: moneyValue(summary.receivable),
      payable: moneyValue(summary.payable)
    },
    recent
  });
});

app.get("/api/transactions", requireAuth, (req, res) => {
  const businessId = businessFilter(req, res);
  if (businessId === false) return;

  const { start, end } = monthRange(req.query.month);
  const where = ["t.user_id = ?", "t.date >= ?", "t.date < ?"];
  const params = [req.user.id, start, end];

  if (businessId) {
    where.push("t.business_id = ?");
    params.push(businessId);
  }

  const transactions = transactionSelect(where.join(" AND "), params).map(
    serializeTransaction
  );
  res.json({ transactions });
});

app.post(
  "/api/transactions",
  requireAuth,
  upload.single("receipt"),
  (req, res) => {
    const type = String(req.body.type || "");
    const amount = moneyValue(req.body.amount);
    const businessId = String(req.body.businessId || "");
    const projectId = String(req.body.projectId || "");
    const categoryId = String(req.body.categoryId || "");
    const status = req.body.status === "pending" ? "pending" : "paid";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || ""))
      ? req.body.date
      : new Date().toISOString().slice(0, 10);

    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "กรุณาเลือกประเภทรายการ" });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: "กรุณาใส่จำนวนเงินมากกว่า 0" });
    }

    const business = getOwnedBusiness(req.user.id, businessId);
    if (!business) {
      return res.status(400).json({ message: "กรุณาเลือกธุรกิจ" });
    }

    let project = null;
    if (projectId) {
      project = getOwnedProject(req.user.id, projectId);
      if (!project || project.business_id !== businessId) {
        return res.status(400).json({ message: "โปรเจกต์ไม่ตรงกับธุรกิจ" });
      }
    }

    let category = null;
    if (categoryId) {
      category = getOwnedCategory(req.user.id, categoryId);
      if (
        !category ||
        category.business_id !== businessId ||
        category.kind !== type
      ) {
        return res.status(400).json({ message: "หมวดหมู่ไม่ตรงกับรายการ" });
      }
    }

    const transactionId = makeId();
    const attachmentPath = req.file
      ? path.relative(dataDir, req.file.path)
      : null;

    db.prepare(
      `
      INSERT INTO transactions (
        id, user_id, business_id, project_id, category_id, type, amount, date,
        status, customer, note, payment_method, attachment_path,
        attachment_original_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      transactionId,
      req.user.id,
      businessId,
      project?.id || null,
      category?.id || null,
      type,
      amount,
      date,
      status,
      String(req.body.customer || "").trim() || null,
      String(req.body.note || "").trim() || null,
      String(req.body.paymentMethod || "").trim() || null,
      attachmentPath,
      req.file?.originalname || null,
      now()
    );

    const row = transactionSelect("t.id = ? AND t.user_id = ?", [
      transactionId,
      req.user.id
    ])[0];
    res.status(201).json({ transaction: serializeTransaction(row) });
  }
);

app.delete("/api/transactions/:id", requireAuth, (req, res) => {
  const transaction = db
    .prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);

  if (!transaction) {
    return res.status(404).json({ message: "ไม่พบรายการนี้" });
  }

  db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id
  );

  if (transaction.attachment_path) {
    const filePath = path.resolve(dataDir, transaction.attachment_path);
    if (filePath.startsWith(uploadRoot) && fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }

  res.json({ ok: true });
});

app.get("/api/projects", requireAuth, (req, res) => {
  const businessId = businessFilter(req, res);
  if (businessId === false) return;

  const where = ["p.user_id = ?"];
  const params = [req.user.id];

  if (businessId) {
    where.push("p.business_id = ?");
    params.push(businessId);
  }

  const projects = db
    .prepare(
      `
      SELECT
        p.*,
        b.name AS business_name,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) AS received,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) AS spent,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'pending' THEN t.amount ELSE 0 END), 0) AS pending_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'pending' THEN t.amount ELSE 0 END), 0) AS pending_expense,
        COUNT(t.id) AS transaction_count
      FROM projects p
      JOIN businesses b ON b.id = p.business_id
      LEFT JOIN transactions t ON t.project_id = p.id AND t.user_id = p.user_id
      WHERE ${where.join(" AND ")}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `
    )
    .all(...params)
    .map((project) => ({
      ...project,
      budget: moneyValue(project.budget),
      received: moneyValue(project.received),
      spent: moneyValue(project.spent),
      profit: moneyValue(project.received - project.spent),
      pending_income: moneyValue(project.pending_income),
      pending_expense: moneyValue(project.pending_expense),
      over_budget: project.budget > 0 && project.spent > project.budget
    }));

  res.json({ projects });
});

app.post("/api/projects", requireAuth, (req, res) => {
  const name = String(req.body.name || "").trim();
  const businessId = String(req.body.businessId || "");
  const budget = Math.max(0, moneyValue(req.body.budget));
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.startDate || ""))
    ? req.body.startDate
    : null;

  if (!name) {
    return res.status(400).json({ message: "กรุณาใส่ชื่อโปรเจกต์" });
  }

  const business = getOwnedBusiness(req.user.id, businessId);
  if (!business) {
    return res.status(400).json({ message: "กรุณาเลือกธุรกิจ" });
  }

  const projectId = makeId();
  db.prepare(
    `
    INSERT INTO projects (
      id, user_id, business_id, name, customer, budget, status, start_date,
      end_date, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    projectId,
    req.user.id,
    businessId,
    name,
    String(req.body.customer || "").trim() || null,
    budget,
    "active",
    startDate,
    null,
    String(req.body.notes || "").trim() || null,
    now()
  );

  const project = getOwnedProject(req.user.id, projectId);
  res.status(201).json({ project });
});

app.get("/api/projects/:id", requireAuth, (req, res) => {
  const project = db
    .prepare(
      `
      SELECT p.*, b.name AS business_name
      FROM projects p
      JOIN businesses b ON b.id = p.business_id
      WHERE p.id = ? AND p.user_id = ?
      `
    )
    .get(req.params.id, req.user.id);

  if (!project) {
    return res.status(404).json({ message: "ไม่พบโปรเจกต์นี้" });
  }

  const transactions = transactionSelect("t.project_id = ? AND t.user_id = ?", [
    project.id,
    req.user.id
  ]).map(serializeTransaction);

  const totals = transactions.reduce(
    (acc, item) => {
      if (item.type === "income" && item.status === "paid") {
        acc.received += item.amount;
      }
      if (item.type === "expense" && item.status === "paid") {
        acc.spent += item.amount;
      }
      if (item.type === "income" && item.status === "pending") {
        acc.pending_income += item.amount;
      }
      if (item.type === "expense" && item.status === "pending") {
        acc.pending_expense += item.amount;
      }
      return acc;
    },
    { received: 0, spent: 0, pending_income: 0, pending_expense: 0 }
  );

  res.json({
    project: {
      ...project,
      budget: moneyValue(project.budget),
      ...totals,
      profit: moneyValue(totals.received - totals.spent),
      over_budget: project.budget > 0 && totals.spent > project.budget
    },
    transactions
  });
});

app.get("/api/attachments/:transactionId", requireAuth, (req, res) => {
  const transaction = db
    .prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?")
    .get(req.params.transactionId, req.user.id);

  if (!transaction?.attachment_path) {
    return res.status(404).send("ไม่พบไฟล์");
  }

  const filePath = path.resolve(dataDir, transaction.attachment_path);
  if (!filePath.startsWith(uploadRoot) || !fs.existsSync(filePath)) {
    return res.status(404).send("ไม่พบไฟล์");
  }

  res.sendFile(filePath);
});

app.get("/api/export/transactions", requireAuth, (req, res) => {
  const businessId = businessFilter(req, res);
  if (businessId === false) return;

  const { month, start, end } = monthRange(req.query.month);
  const where = ["t.user_id = ?", "t.date >= ?", "t.date < ?"];
  const params = [req.user.id, start, end];

  if (businessId) {
    where.push("t.business_id = ?");
    params.push(businessId);
  }

  const rows = transactionSelect(where.join(" AND "), params);
  const header = [
    "วันที่",
    "ธุรกิจ",
    "โปรเจกต์",
    "ประเภท",
    "หมวดหมู่",
    "จำนวนเงิน",
    "สถานะ",
    "ลูกค้า/ผู้ขาย",
    "ช่องทางจ่ายเงิน",
    "หมายเหตุ",
    "ไฟล์แนบ"
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.business_name,
        row.project_name || "",
        row.type === "income" ? "รายรับ" : "รายจ่าย",
        row.category_name || "",
        row.amount,
        row.status === "paid"
          ? row.type === "income"
            ? "รับแล้ว"
            : "จ่ายแล้ว"
          : row.type === "income"
            ? "ค้างรับ"
            : "ค้างจ่าย",
        row.customer || "",
        row.payment_method || "",
        row.note || "",
        row.attachment_original_name || ""
      ]
        .map(csvCell)
        .join(",")
    )
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="transactions-${month}.csv"`
  );
  res.send(`\uFEFF${lines.join("\n")}`);
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(rootDir, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  const message =
    error instanceof multer.MulterError
      ? "ไฟล์ใหญ่เกินไป หรืออัปโหลดไม่สำเร็จ"
      : error.message || "เกิดข้อผิดพลาด";
  res.status(400).json({ message });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
