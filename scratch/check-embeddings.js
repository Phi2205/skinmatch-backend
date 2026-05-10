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
    
    // 1. Check total number of embeddings
    const totalEmbedRes = await client.query('SELECT COUNT(*) FROM product_embeddings;');
    console.log('Tổng số bản ghi trong product_embeddings:', totalEmbedRes.rows[0].count);

    const nullEmbedRes = await client.query('SELECT COUNT(*) FROM product_embeddings WHERE embedding IS NULL;');
    console.log('Số bản ghi có embedding bị NULL:', nullEmbedRes.rows[0].count);

    // 2. Query product_embeddings for products 12, 13, 14
    console.log('\nKiểm tra embeddings cho các sản phẩm nước hoa (ID: 12, 13, 14):');
    const res = await client.query(
      `SELECT pe.id, pe.product_id, p.name, pe.chunk_type, pe.chunk_text, (pe.embedding IS NULL) as is_embedding_null 
       FROM product_embeddings pe
       JOIN products p ON pe.product_id = p.id
       WHERE pe.product_id IN (12, 13, 14)
       ORDER BY pe.product_id, pe.chunk_type;`
    );

    console.log(`Tìm thấy ${res.rows.length} chunks trong product_embeddings cho các sản phẩm này.`);
    res.rows.forEach(row => {
      console.log(`- ID Embed: ${row.id} | Product ID: ${row.product_id} (${row.name})`);
      console.log(`  * Chunk Type: ${row.chunk_type}`);
      console.log(`  * Embedding is NULL: ${row.is_embedding_null}`);
      console.log(`  * Chunk Text Preview:\n${row.chunk_text.slice(0, 150)}...\n`);
    });

    // 3. Query all product IDs that HAVE embeddings
    const activeProductsWithEmbedRes = await client.query(
      `SELECT DISTINCT product_id FROM product_embeddings;`
    );
    console.log('Các Product ID có trong product_embeddings:', activeProductsWithEmbedRes.rows.map(r => r.product_id));

  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    await client.end();
  }
}

main();
