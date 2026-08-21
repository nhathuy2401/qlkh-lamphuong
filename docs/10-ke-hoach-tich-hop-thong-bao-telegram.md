# Kế hoạch tích hợp thông báo Telegram cho QLKH-QMC

> Trạng thái: kế hoạch triển khai
> Kiến trúc đã chọn: Firebase Hosting gọi Make webhook, Make gửi tin qua Telegram Bot API
> Phạm vi: chỉ gửi thông báo một chiều, không nhận lệnh điều khiển từ Telegram
> Ràng buộc: không dùng Firebase Authentication, Cloud Functions hoặc gói Blaze

## 1. Mục tiêu

- Gửi thông báo nghiệp vụ vào một nhóm Telegram dùng chung cho 3-4 người.
- Thông báo chỉ được gửi sau khi thao tác Firestore đã thành công.
- Lỗi Telegram hoặc Make không được làm hỏng thao tác nhập kho, xuất kho hoặc quản lý dữ liệu.
- Giữ quy trình build/deploy hiện tại của Firebase Hosting.
- Không gửi mật khẩu, password hash, access token hoặc nội dung audit chi tiết ra Telegram.
- Không đưa tab/lịch sử audit dành riêng cho `super_admin` vào nhóm Telegram chung.

## 2. Kết luận kiến trúc

Luồng triển khai:

```text
Người dùng thao tác trên QLKH-QMC
  -> app ghi dữ liệu vào Firestore
  -> Firestore trả về thành công
  -> frontend gửi HTTP POST đến Make webhook
  -> Make chuyển nội dung sang Telegram Bot
  -> Bot gửi tin vào nhóm Telegram nội bộ
```

Các thành phần:

```text
Firebase Hosting  -> host React/Vite như hiện tại
Firestore         -> nguồn dữ liệu nghiệp vụ
Make webhook      -> cầu nối miễn phí giữa frontend và Telegram
Telegram Bot      -> gửi tin vào nhóm nội bộ
```

Đây là trigger từ **thao tác thành công trong ứng dụng**, không phải trigger cấp database. Thay đổi dữ liệu trực tiếp trong Firebase Console sẽ không tự gửi Telegram. Nếu sau này cần bắt mọi thay đổi Firestore kể cả ngoài ứng dụng, phải bổ sung Cloud Functions hoặc một backend theo dõi database.

## 3. Phạm vi thông báo

### 3.1 Giai đoạn 1 - nghiệp vụ kho

| Event | Thời điểm gửi | Nội dung chính | Mặc định |
|---|---|---|:---:|
| `order.inbound.created` | Tạo phiếu nhập thành công | Số phiếu, người tạo, ngày, khách hàng, số mặt hàng, tổng số lượng, tổng tiền | Bật |
| `order.outbound.created` | Tạo phiếu xuất thành công | Số phiếu, người tạo, ngày, khách hàng, số mặt hàng, tổng số lượng, tổng tiền | Bật |
| `order.deleted` | Xóa phiếu và hoàn tồn thành công | Loại phiếu, số phiếu, người xóa, số mặt hàng, tổng số lượng đã hoàn | Bật |
| `product.created` | Thêm vật tư thành công | Mã, tên, đơn vị, tồn ban đầu | Bật |
| `product.updated` | Cập nhật vật tư thành công | Mã/tên vật tư và các trường chính đã thay đổi | Tắt |
| `product.deleted` | Xóa vật tư thành công | Mã, tên vật tư, người xóa | Bật |
| `customer.created` | Super admin thêm khách hàng | Tên khách hàng và người tạo | Bật |

Thông báo cập nhật vật tư mặc định tắt để tránh nhóm bị nhiều tin khi người dùng chỉnh sửa liên tục.

### 3.2 Giai đoạn 2 - quản trị

Các event quản trị chỉ gửi nếu cấu hình một chat Telegram riêng dành cho `super_admin`:

- `account.created`
- `account.role_changed`
- `account.disabled`
- `account.enabled`

Không gửi các nội dung sau:

- Mật khẩu hoặc password hash.
- Access token/session token.
- Chi tiết `before`/`after` đầy đủ của audit log.
- Nội dung đổi mật khẩu.
- Danh sách lịch sử quản trị.

Nếu chưa có nhóm riêng cho super admin, bỏ toàn bộ thông báo quản trị khỏi lần triển khai đầu.

## 4. Mẫu nội dung Telegram

### 4.1 Phiếu nhập

```text
📥 QLKH-QMC - Đã tạo phiếu nhập

Số phiếu: PN-2026-0012
Người tạo: Nguyễn Văn A (admin)
Ngày phiếu: 21/08/2026
Khách hàng: Công ty ABC
Mặt hàng: 4
Tổng số lượng: 125
Tổng tiền: 18.500.000 ₫
```

### 4.2 Phiếu xuất

```text
📤 QLKH-QMC - Đã tạo phiếu xuất

Số phiếu: PX-2026-0008
Người tạo: Nguyễn Văn B (staff)
Ngày phiếu: 21/08/2026
Khách hàng: Công ty XYZ
Mặt hàng: 2
Tổng số lượng: 30
Tổng tiền: 4.200.000 ₫
```

### 4.3 Xóa phiếu

```text
🗑️ QLKH-QMC - Đã xóa phiếu xuất

Số phiếu: PX-2026-0008
Người xóa: Nguyễn Văn A (super_admin)
Số mặt hàng: 2
Số lượng hoàn tồn: 30
```

### 4.4 Thêm vật tư

```text
📦 QLKH-QMC - Đã thêm vật tư

Mã: VT-0012
Tên: Dây điện 2.5mm
Đơn vị: Mét
Người thực hiện: Nguyễn Văn A (admin)
```

Nội dung giai đoạn đầu dùng plain text để tránh lỗi escape Markdown/HTML của Telegram.

## 5. Payload gửi đến Make webhook

Frontend gửi một payload thống nhất:

```json
{
  "version": 1,
  "source": "qlkh-qmc",
  "eventId": "request_xxx",
  "eventType": "order.inbound.created",
  "occurredAt": "2026-08-21T10:30:00.000Z",
  "message": "Nội dung plain text đã định dạng",
  "actor": {
    "uid": "user_xxx",
    "displayName": "Nguyễn Văn A",
    "email": "admin@qlkh.local",
    "role": "admin"
  },
  "target": {
    "type": "order",
    "id": "order_xxx",
    "label": "PN-2026-0012"
  },
  "summary": {
    "orderType": "Inbound",
    "itemCount": 4,
    "totalQuantity": 125,
    "totalAmount": 18500000
  }
}
```

Quy ước:

- `eventId` dùng lại `requestId` của mutation để truy vết và chống gửi trùng về sau.
- `message` là nội dung hoàn chỉnh; Make chỉ cần chuyển tiếp sang Telegram để giảm số module/operation.
- `actor` lấy từ session hiện tại.
- `summary` chỉ chứa dữ liệu cần cho thông báo, không chứa toàn bộ document Firestore.
- Thời gian dùng ISO UTC; phần hiển thị trong message dùng múi giờ `Asia/Ho_Chi_Minh`.

## 6. Cấu hình môi trường

Bổ sung vào `.env.example`:

```dotenv
# Telegram notifications through Make
VITE_TELEGRAM_NOTIFY_ENABLED=false
VITE_TELEGRAM_WEBHOOK_URL=
VITE_TELEGRAM_NOTIFY_TIMEOUT_MS=7000
```

Quy tắc:

- Local mặc định `false` để không gửi tin khi phát triển.
- Production đặt `VITE_TELEGRAM_NOTIFY_ENABLED=true`.
- `VITE_TELEGRAM_WEBHOOK_URL` chứa Custom Webhook URL từ Make.
- Nếu thiếu URL, app vẫn hoạt động bình thường và bỏ qua gửi Telegram.
- Biến `VITE_*` được đóng vào bundle frontend; theo quyết định hiện tại, webhook URL được chấp nhận là cấu hình client.

Telegram Bot Token được lưu trong kết nối Telegram của Make, không cần đưa vào source hoặc `.env` của ứng dụng.

## 7. Thay đổi source dự kiến

### 7.1 Service gửi webhook

Tạo `src/services/telegramNotification.js` với các trách nhiệm:

- Đọc feature flag và webhook URL từ `import.meta.env`.
- Chuẩn hóa payload.
- Gửi `POST` JSON đến Make.
- Dùng `AbortController` để timeout theo cấu hình.
- Bắt lỗi HTTP/network và trả trạng thái, không throw ngược vào nghiệp vụ chính.
- Không log nguyên payload nếu payload có email hoặc dữ liệu không cần thiết.

API dự kiến:

```js
sendTelegramNotification({
  eventId,
  eventType,
  actor,
  target,
  summary,
  message,
})
```

### 7.2 Bộ tạo nội dung

Tạo `src/lib/telegramMessages.js`:

- `formatInboundOrderMessage()`
- `formatOutboundOrderMessage()`
- `formatDeletedOrderMessage()`
- `formatProductCreatedMessage()`
- `formatProductDeletedMessage()`
- `formatCustomerCreatedMessage()`
- Hàm định dạng tiền, số lượng và ngày theo tiếng Việt.

Giữ việc tạo message ngoài React component để có thể kiểm thử riêng và tránh lặp code.

### 7.3 Tích hợp vào store

Cập nhật `src/stores/appStore.js` theo nguyên tắc:

```text
1. Tạo requestId.
2. Gọi mutation Firestore hiện có.
3. Chờ mutation thành công.
4. Trả kết quả nghiệp vụ cho giao diện.
5. Gửi Telegram theo cơ chế best-effort, không chặn thao tác chính.
```

Các method cần nối event trong giai đoạn 1:

- `addProduct()`
- `updateProduct()` nếu bật event cập nhật
- `deleteProduct()`
- `addCustomer()`
- `createOrder()`
- `deleteOrder()`

Với `deleteOrder()`, lấy bản tóm tắt phiếu từ MobX store trước khi xóa để message vẫn có số phiếu, loại phiếu và tổng số lượng sau khi document đã bị xóa.

### 7.4 Không dùng collection `notifications` làm trigger Telegram

Collection `notifications` hiện phục vụ thông báo trong ứng dụng. Không cho mọi thiết bị đang mở cùng subscribe rồi gọi webhook, vì một document mới có thể khiến 3-4 client gửi trùng cùng một tin Telegram.

Chỉ client thực hiện mutation gửi webhook sau khi mutation thành công.

## 8. Thiết lập Telegram

1. Mở Telegram và nhắn `@BotFather`.
2. Chạy `/newbot` và tạo bot, ví dụ `QLKH QMC Notify`.
3. Lưu Bot Token để tạo connection trong Make.
4. Tạo nhóm Telegram, ví dụ `QLKH-QMC Thông báo`.
5. Thêm bot vào nhóm.
6. Cấp quyền gửi tin cho bot nếu nhóm đang hạn chế thành viên.
7. Gửi một tin thử trong nhóm để Make/Telegram nhận diện chat.
8. Không cấp quyền quản trị nhóm cho bot nếu chỉ cần gửi thông báo.

Với tin nhắn riêng, người dùng phải chủ động mở bot và bấm `Start` trước. Phương án nhóm chung không cần quản lý từng chat ID của 3-4 người.

## 9. Thiết lập Make Free

Tạo một scenario tối giản:

```text
Webhooks / Custom webhook
  -> Telegram Bot / Send a Text Message or a Reply
```

Các bước:

1. Tạo Custom Webhook và sao chép URL.
2. Chạy `Run once`.
3. Gửi payload mẫu để Make nhận schema.
4. Thêm module Telegram Bot và tạo connection bằng Bot Token.
5. Chọn nhóm Telegram đích.
6. Map trường `message` từ webhook vào nội dung tin nhắn.
7. Không chọn parse mode trong giai đoạn đầu.
8. Bật scenario.
9. Gửi thử một phiếu nhập và kiểm tra tin nhắn thực tế.

Thiết kế một webhook và một module Telegram giúp tiết kiệm operation trên gói miễn phí. Việc chọn icon/nội dung theo event được xử lý tại frontend.

## 10. Xử lý lỗi và độ tin cậy

### 10.1 Nguyên tắc bắt buộc

- Firestore thành công nhưng Telegram lỗi: nghiệp vụ vẫn báo thành công.
- Firestore lỗi: không gửi Telegram.
- Webhook timeout: dừng chờ sau 7 giây và không treo giao diện.
- Make trả HTTP ngoài `2xx`: ghi cảnh báo kỹ thuật ở console trong development.
- Không hiển thị lỗi Telegram thành lỗi đỏ toàn hệ thống.

### 10.2 Gửi lại

Giai đoạn 1 dùng best-effort, không tự retry để tránh gửi trùng.

Giai đoạn 2 có thể thêm local outbox:

```text
localStorage: qlkh-telegram-outbox-v1
  -> lưu tối đa 20 event chưa xác nhận
  -> retry khi trình duyệt online hoặc app được mở lại
  -> xóa event sau phản hồi 2xx
  -> bỏ event quá 7 ngày
```

Khi bật retry, Make cần dùng `eventId` để loại bỏ event trùng bằng Data Store hoặc cơ chế tương đương.

### 10.3 Giới hạn được chấp nhận

- Nếu người dùng đóng tab ngay sau khi Firestore thành công nhưng trước khi webhook hoàn tất, tin có thể bị mất.
- Thay đổi trực tiếp trong Firebase Console không tạo thông báo Telegram.
- Webhook URL có trong bundle Firebase Hosting.
- Người có URL webhook có thể gọi webhook; đây là rủi ro đã được chấp nhận cho nhóm nội bộ ít người.

## 11. Kiểm thử

### 11.1 Kiểm thử chức năng

- Tạo phiếu nhập một mặt hàng và kiểm tra số phiếu, số lượng, tổng tiền.
- Tạo phiếu xuất nhiều mặt hàng và kiểm tra tổng hợp.
- Xóa phiếu và kiểm tra thông tin hoàn tồn.
- Thêm vật tư và khách hàng.
- Tắt feature flag và xác nhận không có request webhook.
- Để trống webhook URL và xác nhận app không lỗi.
- Tạm dừng Make scenario và xác nhận nghiệp vụ Firestore vẫn thành công.
- Đăng nhập bằng role khác nhau và kiểm tra tên/role người thao tác trong tin.
- Xác nhận tin Telegram không có password, token hoặc audit detail.

### 11.2 Kiểm thử build/deploy

```bash
npm run build
firebase deploy --project project-ad668 --only hosting:qlkh
```

Tiêu chí:

- Vite build thành công.
- Firebase Hosting deploy thành công tại `https://qlkh-qmc.web.app`.
- Không cần deploy Firestore Rules, Functions hoặc nâng cấp Blaze.
- Sau deploy, tạo một phiếu test và nhận đúng một tin Telegram.

## 12. Thứ tự triển khai

### Giai đoạn A - cấu hình ngoài source

- Tạo Telegram Bot.
- Tạo nhóm thông báo và thêm bot.
- Tạo Make scenario.
- Kiểm tra Make gửi được một tin mẫu.

### Giai đoạn B - code frontend

- Thêm biến môi trường.
- Thêm service webhook.
- Thêm bộ format message.
- Nối các event nghiệp vụ giai đoạn 1.
- Bổ sung xử lý timeout/lỗi.

### Giai đoạn C - kiểm thử

- Test local với webhook bật.
- Test các role và các loại phiếu.
- Test khi Make tắt hoặc mất mạng.
- Chạy build production.

### Giai đoạn D - phát hành

- Đặt env production.
- Build lại frontend.
- Deploy Firebase Hosting.
- Tạo phiếu thử và kiểm tra nhóm Telegram.
- Theo dõi Make usage trong tuần đầu.

## 13. Tiêu chí nghiệm thu

- Tạo phiếu nhập/xuất thành công sẽ nhận đúng một tin Telegram.
- Tin hiển thị đúng loại phiếu, số phiếu, người thao tác, số lượng và tổng tiền.
- Xóa phiếu thành công có tin thông báo và số lượng hoàn tồn.
- Thêm vật tư/khách hàng gửi đúng nội dung theo cấu hình.
- Lỗi Telegram không làm rollback hoặc báo thất bại cho thao tác Firestore đã thành công.
- Không gửi password, token hoặc audit history.
- Build và deploy chỉ dùng Firebase Hosting như hiện tại.
- Tắt `VITE_TELEGRAM_NOTIFY_ENABLED` sẽ vô hiệu hóa toàn bộ thông báo mà không cần sửa code.

## 14. Rollback

Rollback nhanh nhất:

```dotenv
VITE_TELEGRAM_NOTIFY_ENABLED=false
```

Sau đó build và deploy lại Firebase Hosting. Không cần thay đổi dữ liệu Firestore và không ảnh hưởng các chức năng đang chạy.

Nếu Make hoặc Telegram có sự cố dài ngày, tắt scenario trên Make và giữ ứng dụng hoạt động bình thường.

## 15. Tài liệu tham khảo

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Bot FAQ: https://core.telegram.org/bots/faq
- Make pricing: https://www.make.com/en/pricing
- Firebase Hosting: https://firebase.google.com/docs/hosting
