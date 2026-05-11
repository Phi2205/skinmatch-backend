import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

class MockChatbotService {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.logger = {
      log: (msg) => console.log(`[LOG] ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${msg}`),
      error: (msg) => console.error(`[ERROR] ${msg}`),
    };
  }

  // Copy of our condenseQuery method from chatbot.service.ts
  async condenseQuery(message, chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return message;
    }

    try {
      const systemPrompt = `Bạn là một trợ lý AI chuyên nghiệp có nhiệm vụ phân tích lịch sử hội thoại và tin nhắn mới nhất của người dùng, sau đó viết lại tin nhắn mới nhất thành một câu TRUY VẤN TÌM KIẾM ĐỘC LẬP (standalone search query) bằng tiếng Việt để tìm kiếm sản phẩm tối ưu nhất trong cơ sở dữ liệu.

HƯỚNG DẪN VIẾT LẠI:
1. Nếu tin nhắn mới nhất là câu hỏi độc lập, đầy đủ nghĩa, hoặc chỉ là câu chào hỏi, cám ơn đơn giản, hãy giữ nguyên tin nhắn đó (không viết lại).
2. Nếu tin nhắn chứa đại từ chỉ định, từ thay thế hoặc ngầm ám chỉ đến ngữ cảnh trước đó (ví dụ: "loại đó", "mấy sản phẩm này", "nó", "còn loại nào khác", "cho mình thông tin thêm", "giá bao nhiêu", "dùng thế nào", "có tốt không", v.v.), hãy phân tích lịch sử hội thoại để xác định rõ đối tượng được nhắc tới, sau đó viết lại thành câu truy vấn rõ ràng chứa tên sản phẩm hoặc loại sản phẩm cụ thể.
3. Câu viết lại phải ngắn gọn, tự nhiên, tập trung vào các từ khóa chính của sản phẩm (ví dụ: "Thông tin chi tiết nước hoa nam Laura Anne Diamond Homme và Armaf Club De Nuit Intense Man").
4. Tuyệt đối chỉ trả về DUY NHẤT câu truy vấn đã viết lại dưới dạng văn bản thường, không có thêm lời giải thích, không nằm trong dấu ngoặc kép.`;

      const recentHistory = chatHistory.slice(-5);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: `Hãy viết lại tin nhắn này: "${message}"` }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.1,
      });

      const rewritten = (completion.choices[0].message.content || '').trim();
      this.logger.log(`[RAG Query Reformulation] Gốc: "${message}" -> Viết lại: "${rewritten}"`);
      return rewritten || message;
    } catch (error) {
      this.logger.warn(`Lỗi khi viết lại câu hỏi: ${error.message}`);
      return message;
    }
  }
}

async function main() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    console.error('Lỗi: Không tìm thấy file .env.');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const apiKeyLine = envContent.split('\n').find(line => line.trim().startsWith('OPENAI_API_KEY='));

  const apiKey = apiKeyLine 
    ? apiKeyLine.split('OPENAI_API_KEY=')[1].replace(/"/g, '').replace(/'/g, '').trim()
    : null;

  if (!apiKey) {
    console.error('Lỗi: Không tìm thấy OPENAI_API_KEY.');
    return;
  }

  const service = new MockChatbotService(apiKey);

  // Re-create the exact user conversation from the logs
  const chatHistory = [
    { role: 'user', content: 'Nước hoa nam?' },
    { 
      role: 'assistant', 
      content: 'Chào bạn! Nếu bạn đang tìm kiếm nước hoa nam, mình có thể giới thiệu cho bạn một số sản phẩm nổi bật như Nước Hoa Nam Laura Anne Diamond Homme 45ml hoặc Nước Hoa Nam Armaf Club De Nuit Intense Man EDT 105ml. Cả hai đều mang đến hương thơm quyến rũ và phù hợp với nhiều dịp khác nhau. Nếu bạn cần thêm thông tin chi tiết về một sản phẩm cụ thể nào đó, hãy cho mình biết nhé!' 
    }
  ];

  const followUpMessage = "Cho tôi thông tin 2 loại đó đi?";
  console.log('--- CHẠY THỬ NGHIỆM VIẾT LẠI TRUY VẤN ---');
  console.log('Lịch sử cuộc hội thoại:');
  chatHistory.forEach(msg => {
    console.log(`- ${msg.role.toUpperCase()}: ${msg.content}`);
  });
  console.log(`- USER MỚI NHẤT: ${followUpMessage}`);
  console.log('\nĐang gọi OpenAI...');

  const result = await service.condenseQuery(followUpMessage, chatHistory);
  console.log('\nKết quả nhận được:', result);
}

main();
