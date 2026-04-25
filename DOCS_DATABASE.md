# Tài liệu Cấu trúc Cơ sở dữ liệu (SkinMatch)

Tài liệu này giải thích ý nghĩa các bảng và mối quan hệ trong hệ thống quản lý mỹ phẩm SkinMatch sử dụng Prisma ORM.

## 1. Hệ thống Người dùng (Authentication & Profiles)

### Bảng `users`
Lưu trữ thông tin tài khoản và phân quyền.
- `id`: Định danh duy nhất.
- `email`: Email dùng để đăng nhập (Unique).
- `password_hash`: Mật khẩu đã mã hóa (Optional để hỗ trợ OAuth2).
- `role`: Quyền hạn (`ADMIN` hoặc `USER`).
- `is_verified`: Xác thực tài khoản.

### Bảng `skin_profiles`
Hồ sơ đặc điểm da của người dùng để cá nhân hóa gợi ý.
- `user_id`: Liên kết trực tiếp với người dùng.
- `skin_type`: Loại da (Khô, Dầu, Hỗn hợp...).
- `sensitivity`: Mức độ nhạy cảm.

---

## 2. Hệ thống Sản phẩm (Products & Catalog)

### Bảng `products`
Thông tin chi tiết về mỹ phẩm.
- `name`: Tên sản phẩm.
- `price`: Giá niêm yết.
- `category_id`: Liên kết đến danh mục sản phẩm.
- `is_featured`: Đánh dấu sản phẩm nổi bật trên trang chủ.
- `image_url`: Ảnh sản phẩm.

### Bảng `categories`
Phân loại sản phẩm (Sữa rửa mặt, Serum, Kem dưỡng...).

### Bảng `ingredients`
Danh sách các thành phần (Niacinamide, Retinol, Vitamin C...). 

---

## 3. Các bảng quan hệ (Mapping Tables)

Hệ thống sử dụng các bảng trung gian cho quan hệ Many-to-Many:
- `product_ingredients`: Liên kết Sản phẩm - Thành phần.
- `product_concerns`: Liên kết Sản phẩm - Vấn đề da.
- `product_skin_types`: Liên kết Sản phẩm - Loại da phù hợp.
- `product_badges`: Liên kết Sản phẩm - Các nhãn đặc tính.

---

## 4. Hệ thống Nội dung & Homepage (CMS)

### Bảng `banners`
Quản lý các nội dung hiển thị trên Hero Section.
- `title`, `description`: Tiêu đề và mô tả của banner.
- `image_url`: Hình ảnh banner.
- `is_active`: Trạng thái bật/tắt.

### Bảng `badges`
Các nhãn đặc tính (Vegan, Cruelty-free, Eco-pack...).
- `name`: Tên nhãn.
- `icon_url`: Đường dẫn icon.

---

## 5. Hệ thống Đơn hàng (Orders & E-commerce)

### Bảng `orders`
Thông tin tổng quát về giao dịch.
- `status`: Trạng thái (PENDING, COMPLETED...).
- `total_price`: Tổng tiền.

### Bảng `order_items`
Chi tiết từng sản phẩm trong đơn hàng.

---

## 6. Theo dõi hành vi (Analytics)

### Bảng `user_behaviors`
Ghi lại mọi tương tác của người dùng (`view`, `add_to_cart`).
