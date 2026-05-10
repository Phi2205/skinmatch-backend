import http from 'http';

async function queryStream(message, sessionId = 'test-stream-session') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ message, sessionId });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/chatbot/ask-stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`\n--- PHẢN HỒI CHO TIN NHẮN: "${message}" ---`);
      console.log(`STATUS: ${res.statusCode}`);
      console.log('HEADERS:', JSON.stringify(res.headers));
      
      res.setEncoding('utf8');
      
      res.on('data', (chunk) => {
        // Parse the SSE chunks (each chunk starts with "data: ")
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              console.log('\n[HỆ THỐNG]: Stream hoàn tất [DONE].');
            } else {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'chunk') {
                  process.stdout.write(parsed.content);
                } else if (parsed.type === 'products') {
                  console.log('\n\n[SẢN PHẨM ĐỀ XUẤT]:');
                  console.log(JSON.stringify(parsed.products, null, 2));
                } else if (parsed.type === 'error') {
                  console.error(`\n[LỖI]: ${parsed.message}`);
                }
              } catch (err) {
                // Ignore partial or non-json data
              }
            }
          }
        }
      });

      res.on('end', () => {
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Lỗi request: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // 1. Test "câu trả lời nhanh" (không cần stream)
    console.log('--- TEST 1: CÂU TRẢ LỜI NHANH (GREETINGS) ---');
    await queryStream('chào shop');

    console.log('\n======================================\n');

    // 2. Test RAG có stream chữ và trả thẻ sản phẩm ở cuối
    console.log('--- TEST 2: CÂU HỎI RAG NƯỚC HOA NAM (CÓ STREAM) ---');
    await queryStream('Da mình bình thường thì dùng được nước hoa Laura Anne Đen không?');
  } catch (error) {
    console.error('Đã xảy ra lỗi khi test:', error);
  }
}

main();
