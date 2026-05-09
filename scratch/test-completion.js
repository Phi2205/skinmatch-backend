import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

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

  const openai = new OpenAI({ apiKey });

  const contextText = `[SẢN PHẨM 1 - ID: 14]:
ID Sản Phẩm: 14
Tên Sản Phẩm: Nước Hoa Nam Laura Anne Diamond Homme 45ml (Đen)
Danh mục: Nước hoa
Tóm tắt (summary): Nước Hoa Laura Anne Diamond Cho Nam 45ml là sản phẩm nước hoa nam đến từ thương hiệu Laura Anne được sản xuất trực tiếp tại Việt Nam với nguồn nguyên liệu nhập khẩu theo công nghệ Singapore.
Loại da phù hợp: Mọi da
Giải quyết vấn đề da: Thơm lâu
---

[SẢN PHẨM 2 - ID: 14]:
ID Sản Phẩm: 14
Tên Sản Phẩm: Nước Hoa Nam Laura Anne Diamond Homme 45ml (Đen)
Cách dùng (usage_instructions): Xịt trực tiếp lên các vùng da ở cổ, cổ tay, sau gáy hoặc khoảng không trước mặt và bước tới.Tránh để nước hoa dính vào mắt.
Thành phần đầy đủ (ingredient_full_text): 1. Nước Hoa Nam Laura Anne Diamond Pour Homme 45ml (Đen)Các tầng hương:Hương đầu: bưởi, chanh, lá bạc hà...
---`;

  const systemPrompt = `Bạn là "SkinMatch AI Expert" - Trợ lý và Chuyên gia tư vấn da liễu số một của nền tảng mỹ phẩm SkinMatch.
Nhiệm vụ của bạn là lắng nghe câu hỏi từ khách hàng, giải thích khoa học dựa trên hoạt chất thành phần và đưa ra gợi ý sản phẩm phù hợp từ ngữ cảnh cung cấp.

BẠN PHẢI TRẢ VỀ PHẢN HỒI DƯỚI DẠNG MỘT ĐỐI TƯỢNG JSON CÓ CẤU TRÚC CHÍNH XÁC SAU:
{
  "answer": "Nội dung câu trả lời của bạn gửi cho khách hàng (sử dụng định dạng Markdown nếu cần thiết).",
  "recommendedProductIds": [các_id_số_hoặc_chuỗi_của_sản_phẩm_được_đề_xuất]
}

HÃY TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC ĐIỀN THÔNG TIN JSON:
1. LUẬT RECOMMEND SẢN PHẨM (QUAN TRỌNG NHẤT):
   - Bạn PHẢI điền ID của sản phẩm vào mảng "recommendedProductIds" khi:
     + Bạn giới thiệu, nhắc tên, hướng dẫn sử dụng, so sánh hoặc cung cấp thông tin chi tiết (thành phần, cách dùng, công dụng, giá cả) về sản phẩm đó trong câu trả lời "answer".
     + Người dùng hỏi mua, hỏi tìm sản phẩm cụ thể hoặc yêu cầu gợi ý/tư vấn sản phẩm phù hợp với làn da của họ.
   - Tuyệt đối để mảng "recommendedProductIds" là mảng rỗng [] khi:
     + Người dùng chỉ chào hỏi, nói lời cảm ơn, hoặc hỏi các thông tin ngoài lề không liên quan.
     + Người dùng hỏi các kiến thức da liễu chung mang tính lý thuyết suông (ví dụ: "da dầu là gì", "nguyên nhân gây mụn") mà bạn không giới thiệu hay nhắc đến bất kỳ sản phẩm cụ thể nào trong câu trả lời.
   - Chỉ lấy các ID sản phẩm thực sự xuất hiện trong phần "NGỮ CẢNH SẢN PHẨM KHẢ DỤNG" bên dưới. Tuyệt đối không tự bịa đặt ID hay sản phẩm khác.

2. PHÂN TÍCH THÀNH PHẦN KHOA HỌC: Giải thích cặn kẽ tại sao sản phẩm đó phù hợp với vấn đề da của họ bằng cách chỉ rõ các thành phần hoạt chất nổi bật (Active Ingredients) xuất hiện trong ngữ cảnh.
3. GIỌNG ĐIỆU CHUYÊN NGHIỆP: Giọng điệu thân thiện, ấm áp, đáng tin cậy nhưng khoa học. Gọi người dùng là "bạn" và xưng "SkinMatch" hoặc "mình".
4. LƯU Ý AN TOÀN: Hãy luôn khuyên người dùng test thử sản phẩm mới trên một vùng da nhỏ trước khi thoa toàn mặt.

---
NGỮ CẢNH SẢN PHẨM KHẢ DỤNG TRÊN SKINMATCH:
${contextText}
`;

  const chatHistory = [
    { role: 'user', content: 'Nước hoa nam?' },
    { role: 'assistant', content: 'Chào bạn! Hiện tại, trên SkinMatch có một sản phẩm nước hoa nam nổi bật là:\n\n- **Nước Hoa Nam Laura Anne Diamond Homme 45ml (Đen)**...' }
  ];

  const followUpMessage = "Cho tôi thông tin 2 loại đó đi?";

  const messagesForLLM = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: followUpMessage },
  ];

  console.log('Đang gọi GPT-4o-mini...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messagesForLLM,
    temperature: 0.35,
    response_format: { type: 'json_object' },
  });

  console.log('\n--- PHẢN HỒI THÔ TỪ LLM (SAU KHI CẢI TIẾN PROMPT) ---');
  console.log(completion.choices[0].message.content);
}

main();
