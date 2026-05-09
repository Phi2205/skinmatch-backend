import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { OpenAI } from 'openai';

const { Client } = pg;

async function main() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    console.error('Lỗi: Không tìm thấy file .env ở thư mục gốc.');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
  const apiKeyLine = envContent.split('\n').find(line => line.trim().startsWith('OPENAI_API_KEY='));

  if (!dbUrlLine) {
    console.error('Lỗi: Không tìm thấy biến DATABASE_URL trong file .env.');
    return;
  }
  
  const databaseUrl = dbUrlLine
    .split('DATABASE_URL=')[1]
    .replace(/"/g, '')
    .replace(/'/g, '')
    .trim();

  const apiKey = apiKeyLine 
    ? apiKeyLine.split('OPENAI_API_KEY=')[1].replace(/"/g, '').replace(/'/g, '').trim()
    : null;

  if (!apiKey) {
    console.error('Lỗi: Không tìm thấy biến OPENAI_API_KEY trong file .env.');
    return;
  }

  const openai = new OpenAI({ apiKey });
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const queryMessage = "Nước Hoa Nam Laura Anne Diamond Homme 45ml";
  console.log(`Đang chạy thử nghiệm với câu truy vấn: "${queryMessage}"...\n`);

  try {
    await client.connect();

    // 1. Sinh Vector Embedding sử dụng text-embedding-3-small
    console.log('1. Đang gọi OpenAI embeddings.create (model: text-embedding-3-small)...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryMessage.replace(/\n/g, ' '),
    });
    const queryVector = response.data[0].embedding;
    const vectorSqlStr = `[${queryVector.join(',')}]`;

    // 2. Chạy Vector Search nguyên bản
    console.log('\n2. Kết quả Vector Search (Top 15):');
    const vectorRes = await client.query(`
      SELECT 
        pe.id, 
        pe.product_id, 
        p.name,
        pe.chunk_type, 
        pe.chunk_text, 
        (pe.embedding <=> $1::vector) as distance
      FROM "product_embeddings" pe
      INNER JOIN "products" p ON pe.product_id = p.id
      WHERE p.is_active = true AND pe.embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT 15;
    `, [vectorSqlStr]);

    vectorRes.rows.forEach((row, idx) => {
      console.log(`[Rank ${idx + 1}] ID: ${row.product_id} | Distance: ${row.distance.toFixed(6)} | ${row.name} (${row.chunk_type})`);
    });

    // 3. Chạy Keyword Search nguyên bản
    console.log('\n3. Kết quả Keyword Search (Top 15):');
    const keywordRes = await client.query(`
      SELECT 
        pe.id, 
        pe.product_id, 
        p.name,
        pe.chunk_type, 
        pe.chunk_text
      FROM "product_embeddings" pe
      INNER JOIN "products" p ON pe.product_id = p.id
      WHERE p.is_active = true AND (
        to_tsvector('simple', pe.chunk_text) @@ plainto_tsquery('simple', $1)
        OR pe.chunk_text ILIKE $2
      )
      LIMIT 15;
    `, [queryMessage, `%${queryMessage}%`]);

    if (keywordRes.rows.length === 0) {
      console.log('Không tìm thấy kết quả nào bằng Keyword Search.');
    } else {
      keywordRes.rows.forEach((row, idx) => {
        console.log(`[Keyword Rank ${idx + 1}] ID: ${row.product_id} | ${row.name} (${row.chunk_type})`);
      });
    }

    // 4. Kiểm tra xem sản phẩm 13 và 14 có khoảng cách như thế nào với vector query của chúng ta
    console.log('\n4. Kiểm tra khoảng cách cụ thể cho các sản phẩm Nước Hoa (ID: 12, 13, 14):');
    const specificRes = await client.query(`
      SELECT 
        pe.id, 
        pe.product_id, 
        p.name,
        pe.chunk_type, 
        (pe.embedding <=> $1::vector) as distance
      FROM "product_embeddings" pe
      INNER JOIN "products" p ON pe.product_id = p.id
      WHERE pe.product_id IN (12, 13, 14)
      ORDER BY distance ASC;
    `, [vectorSqlStr]);

    specificRes.rows.forEach(row => {
      console.log(`Product ID: ${row.product_id} | Distance: ${row.distance.toFixed(6)} | ${row.name} (${row.chunk_type})`);
    });

  } catch (error) {
    console.error('Lỗi khi chạy thử nghiệm:', error.message);
  } finally {
    await client.end();
  }
}

main();
