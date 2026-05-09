import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';

async function main() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    console.error('Lỗi: Không tìm thấy file .env ở thư mục gốc.');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const redisUrlLine = envContent.split('\n').find(line => line.trim().startsWith('REDIS_URL='));
  
  let redisUrl = 'redis://localhost:6379';
  if (redisUrlLine) {
    redisUrl = redisUrlLine
      .split('REDIS_URL=')[1]
      .replace(/"/g, '')
      .replace(/'/g, '')
      .trim();
  }

  console.log(`Đang kết nối Redis: ${redisUrl}`);
  const redis = new Redis(redisUrl);

  try {
    const keys = await redis.keys('chatbot:session:*');
    console.log(`Tìm thấy ${keys.length} session trong Redis:`, keys);

    for (const key of keys) {
      console.log(`\n===========================================`);
      console.log(`Session Key: ${key}`);
      const val = await redis.get(key);
      if (val) {
        try {
          const parsed = JSON.parse(val);
          console.log(`Số tin nhắn: ${parsed.length}`);
          parsed.forEach((msg, idx) => {
            console.log(`[Message ${idx + 1}] Role: ${msg.role}`);
            console.log(`* Content: ${msg.content}`);
            if (msg.timestamp) console.log(`* Time: ${msg.timestamp}`);
            console.log(`---`);
          });
        } catch {
          console.log(`Giá trị thô (không parse được JSON): ${val}`);
        }
      }
    }
  } catch (error) {
    console.error('Lỗi truy vấn Redis:', error.message);
  } finally {
    redis.disconnect();
  }
}

main();
