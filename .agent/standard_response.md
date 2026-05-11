# Chuẩn API Response Format

Để đảm bảo tính nhất quán giữa tất cả các module và controllers, mọi API endpoint trong dự án này ĐỀU PHẢI trả về theo cấu trúc sau:

```typescript
{
  success: boolean, // true nếu thành công, false nếu thất bại
  message: string,  // Thông báo trả về thân thiện với người dùng
  data: any         // Dữ liệu payload (object, array, hoặc null)
}
```

## Ví dụ sử dụng trong Controller:

```typescript
  @Post()
  async create(@Body() dto: CreateDto) {
    const data = await this.service.create(dto);
    
    // Format chuẩn
    return {
      success: true,
      message: 'Created successfully',
      data,
    };
  }
```

Mọi tác vụ code liên quan tới việc thêm mới API hay sửa API đều phải tuân thủ nghiêm ngặt cấu trúc này.
