# Deploy ออนไลน์จริง

แอปนี้เป็น Node.js + React + SQLite และเก็บสลิปเป็นไฟล์ จึงต้องใช้ hosting ที่มี persistent disk

## แนะนำ: Render

1. เอาโปรเจกต์นี้ขึ้น GitHub
2. เข้า Render แล้วเลือก New > Blueprint
3. เลือก repo นี้
4. Render จะอ่าน `render.yaml` และสร้าง Web Service พร้อม disk ให้
5. หลัง deploy เสร็จ เปิด URL ที่ Render ให้มา

ค่าที่ตั้งไว้ใน `render.yaml`:

- `DATA_DIR=/var/data` เพื่อให้ SQLite และสลิปอยู่บน persistent disk
- `JWT_SECRET` ให้ Render สุ่มให้
- `REGISTRATION_CODE` ให้ Render สุ่มให้ เพื่อกันคนอื่นสมัครบัญชีมั่ว

ถ้าต้องการสมัคร user แรก ให้ดูค่า `REGISTRATION_CODE` ในหน้า Environment ของ Render แล้วกรอกในฟอร์มสมัครใช้งาน

## Deploy ด้วย Docker/Fly.io

แอปมี `Dockerfile` แล้ว ต้อง mount volume ไปที่ `/data` และตั้ง env:

```bash
NODE_ENV=production
DATA_DIR=/data
JWT_SECRET=สุ่มยาวๆ
REGISTRATION_CODE=รหัสสมัครของคุณ
```

## Backup

ไฟล์สำคัญอยู่ใน `DATA_DIR`:

- `app.sqlite`
- `uploads/`

ควร backup ทั้งโฟลเดอร์นี้เป็นประจำ
