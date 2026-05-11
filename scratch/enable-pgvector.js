import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function main() {
  console.log('--- ĐANG KÍCH HOẠT PGVECTOR TRÊN POSTGRESQL ---');
  
  // 1. Đọc DATABASE_URL từ file .env
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    console.error('Lỗi: Không tìm thấy file .env ở thư mục gốc.');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
  
  if (!dbUrlLine) {
    console.error('Lỗi: Không tìm thấy biến DATABASE_URL trong file .env.');
    return;
  }
  
  const databaseUrl = dbUrlLine
    .split('DATABASE_URL=')[1]
    .replace(/"/g, '')
    .replace(/'/g, '')
    .trim();

  console.log('Đang kết nối tới database...');

  // 2. Kết nối và thực hiện kích hoạt extension pgvector
  // Do database của Render yêu cầu SSL (sslmode=require), cấu hình ssl: true
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Kết nối thành công! Đang kích hoạt extension pgvector...');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Chúc mừng! Kích hoạt thành công extension pgvector trên database!');
    
  } catch (error) {
    console.error('Gặp lỗi khi kích hoạt extension pgvector:', error.message);
    console.error('\nLưu ý: Nếu bạn sử dụng tài khoản PostgreSQL không có quyền SUPERUSER hoặc database không hỗ trợ pgvector, hãy kiểm tra lại quyền truy cập hoặc cấu hình nhà cung cấp Cloud DB (Render/Neon/Supabase hỗ trợ sẵn pgvector).');
  } finally {
    await client.end();
  }
}

main();
