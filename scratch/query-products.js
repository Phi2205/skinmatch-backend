import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function main() {
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

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    // 1. Query general products info
    const totalRes = await client.query('SELECT COUNT(*) FROM products;');
    console.log('Tổng số sản phẩm:', totalRes.rows[0].count);
    
    const activeRes = await client.query('SELECT COUNT(*) FROM products WHERE is_active = true;');
    console.log('Số sản phẩm active:', activeRes.rows[0].count);

    // 2. Query products with name containing specific keywords
    const searchKeywords = ['Laura', 'Armaf', 'Diamond', 'Club De Nuit', 'Nước Hoa', 'Perfume'];
    console.log('\nTìm kiếm theo từ khóa:');
    for (const kw of searchKeywords) {
      const res = await client.query(
        'SELECT id, name, is_active FROM products WHERE name ILIKE $1;',
        [`%${kw}%`]
      );
      console.log(`- Từ khóa "${kw}": Tìm thấy ${res.rows.length} sản phẩm:`);
      res.rows.forEach(row => {
        console.log(`  * ID: ${row.id} - ${row.name} (Active: ${row.is_active})`);
      });
    }

    // 3. Print all products in the database
    console.log('\nDanh sách tất cả sản phẩm trong database:');
    const allRes = await client.query('SELECT id, name, is_active FROM products ORDER BY id ASC;');
    allRes.rows.forEach(row => {
      console.log(`- ID: ${row.id} - ${row.name} (Active: ${row.is_active})`);
    });

  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    await client.end();
  }
}

main();
