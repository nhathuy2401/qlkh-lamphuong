# Kế hoạch chuyển đổi dữ liệu sang Firebase Firestore, phân quyền và audit log

> Trạng thái: đã triển khai Firestore-only lên Firebase
> Phạm vi thực thi: React/Vite PWA hiện tại và Cloud Firestore Standard, không sử dụng Firebase Authentication
> Mục tiêu chính: đồng bộ dữ liệu nhiều thiết bị, phân quyền thật ở backend, thêm quản lý tài khoản và lịch sử thao tác dành cho `super_admin`

> Cập nhật implementation: đã tạo Web App `QLKH Web`, chuyển client sang Firestore SDK, deploy public Firestore rules/indexes và frontend Hosting tại `https://qlkh-qmc.web.app`. Đã seed 1.294 vật tư, 9 khách hàng và tài khoản `super_admin` `admin@qlkh.local` với mật khẩu `Admin@123456`.

> **Quyết định thực thi cuối cùng:** Firestore public, không Firebase Authentication, không Cloud Functions. Collection `users` chứa thông tin đăng nhập/role và session được giữ ở trình duyệt. Đây là mô hình tin cậy frontend theo yêu cầu; bất kỳ người nào có Firebase config đều có thể đọc/ghi dữ liệu và tự sửa role. Các phần thiết kế Auth/RTDB/Cloud Functions bên dưới được giữ làm lịch sử phương án an toàn, không còn là kiến trúc đang chạy.

## 1. Kết luận kiến trúc

Ứng dụng đang chạy theo mô hình:

```text
Firestore SDK            -> nguồn dữ liệu chính và đồng bộ realtime
Firestore public rules   -> cho phép client đọc/ghi trực tiếp theo yêu cầu
users collection         -> email, SHA-256 passwordHash, role và trạng thái
MobX                     -> state/cache của giao diện
localStorage             -> chỉ giữ session frontend
```

Không cho client tự tạo tài khoản, tự gán role, ghi audit log hoặc trực tiếp sửa các node nghiệp vụ quan trọng. Các thao tác đó phải đi qua Cloud Functions dùng Firebase Admin SDK.

## 2. Hiện trạng source cần thay đổi

### 2.1 Dữ liệu

- `src/stores/appStore.js` đang nạp một object lớn từ key `qlkh-local-data-v1`.
- Mỗi mutation gọi `persist()` và ghi lại toàn bộ object vào `localStorage`.
- Dữ liệu hiện có gồm `customers`, `products`, `orders`, `movements`, `notifications` và `audit`.
- `createOrder()` và `deleteOrder()` đang cập nhật nhiều nhóm dữ liệu trong một lần thay đổi object local.
- Dữ liệu mặc định được nạp từ `src/data/materials.json` và `src/data/customers.json`.

### 2.2 Xác thực và phân quyền

- `src/components/auth/Login.jsx` đang kiểm tra cứng tài khoản `admin/admin`.
- Session đang lưu trong `localStorage` với key `qlkh-local-session-v1`.
- `src/lib/navigation.js` hiển thị cùng một danh sách tab cho mọi người dùng.
- Các component và `appStore` chưa kiểm tra quyền trước khi thực hiện action.
- Role trong tài liệu cũ chưa được thực thi bằng backend hoặc Firebase Security Rules.

### 2.3 Firebase

- Package `firebase` đã có trong dependencies.
- `firebase.json` hiện mới cấu hình Hosting.
- Chưa có Firebase App initialization, Authentication, Realtime Database, Functions, Emulator Suite hoặc database rules.

## 3. Phạm vi chức năng sau chuyển đổi

### 3.1 Bắt buộc

- Đăng nhập bằng Firebase Authentication Email/Password.
- Đồng bộ vật tư, khách hàng, phiếu, biến động kho và thống kê giữa nhiều thiết bị.
- Dữ liệu cập nhật realtime trên các màn hình đang mở.
- Phân quyền được kiểm tra tại backend, không chỉ ẩn nút ở giao diện.
- Thêm role mới `super_admin`.
- Chỉ `super_admin` thấy tab **Quản lý tài khoản**.
- Chỉ `super_admin` thấy tab **Lịch sử quản trị**.
- Chỉ `super_admin` được tạo khách hàng mới; các role khác chỉ sử dụng danh sách khách hàng đã có.
- `super_admin` xem được admin nào đã thêm, sửa hoặc xóa dữ liệu gì.
- Audit log lưu người thao tác, thời gian, action, dữ liệu trước và sau thay đổi.
- Không role nào được sửa hoặc xóa audit log từ ứng dụng.
- Có công cụ nhập dữ liệu local hiện tại lên RTDB đúng một lần.
- Có backup và phương án rollback khi cutover.

### 3.2 Ngoài phạm vi đợt đầu

- Đăng nhập Google, Microsoft hoặc SSO doanh nghiệp.
- Quản lý nhiều công ty/tenant độc lập.
- Phân quyền tùy biến theo từng user hoặc từng vật tư.
- Audit lịch sử xem màn hình, click nút không làm thay đổi dữ liệu.
- Ghi nội dung mật khẩu, token hoặc thông tin xác thực nhạy cảm vào audit log.

## 4. Mô hình role đề xuất

Giữ các role hiện có và bổ sung `super_admin`. Tất cả role đã đăng nhập có đầy đủ quyền nghiệp vụ kho, ngoại trừ action tạo khách hàng mới. Quyền tạo khách hàng, quản lý tài khoản/role và xem History chỉ thuộc `super_admin`.

Trong tài liệu này, **đầy đủ quyền nghiệp vụ kho** gồm xem, thêm, sửa và xóa vật tư; tạo/xóa phiếu nhập/xuất; hoàn tồn; xem dashboard và thống kê; xem/chọn/sửa/xóa khách hàng đã có. Riêng `createCustomer`, quản lý tài khoản, gán role và xem History yêu cầu `super_admin`.

| Role | Ý nghĩa |
|---|---|
| `super_admin` | Quản trị hệ thống, quản lý tài khoản, role và xem toàn bộ audit log |
| `admin` | Đầy đủ nghiệp vụ kho nhưng không tạo khách hàng, không quản lý tài khoản/role và không xem History |
| `warehouse_manager` | Đầy đủ nghiệp vụ kho nhưng không tạo khách hàng, không quản lý tài khoản/role và không xem History |
| `staff` | Đầy đủ nghiệp vụ kho nhưng không tạo khách hàng, không quản lý tài khoản/role và không xem History |
| `user` | Đầy đủ nghiệp vụ kho nhưng không tạo khách hàng, không quản lý tài khoản/role và không xem History |

### 4.1 Ma trận quyền ban đầu

| Chức năng | super_admin | admin | warehouse_manager | staff | user |
|---|:---:|:---:|:---:|:---:|:---:|
| Đăng nhập, đăng xuất | Có | Có | Có | Có | Có |
| Xem dashboard/kho/thống kê | Có | Có | Có | Có | Có |
| Thêm/sửa vật tư | Có | Có | Có | Có | Có |
| Xóa vật tư | Có | Có | Có | Có | Có |
| Tạo phiếu nhập/xuất | Có | Có | Có | Có | Có |
| Xóa phiếu và hoàn tồn | Có | Có | Có | Có | Có |
| Xem/chọn khách hàng đã có | Có | Có | Có | Có | Có |
| Sửa/xóa khách hàng đã có | Có | Có | Có | Có | Có |
| Thêm khách hàng mới | Có | Không | Không | Không | Không |
| Xem danh sách tài khoản | Có | Không | Không | Không | Không |
| Tạo/khóa/mở tài khoản | Có | Không | Không | Không | Không |
| Gán hoặc đổi role | Có | Không | Không | Không | Không |
| Xem lịch sử quản trị | Có | Không | Không | Không | Không |
| Xóa/sửa audit log | Không | Không | Không | Không | Không |

Ma trận này là nguồn chuẩn để triển khai đồng thời ở ba lớp. Với action nghiệp vụ kho thông thường, Functions chỉ cần xác nhận tài khoản hợp lệ và đang hoạt động. Với `createCustomer`, account/role/History, Functions và Rules phải yêu cầu claim `super_admin`.

1. Cloud Functions kiểm tra tài khoản hợp lệ; yêu cầu role `super_admin` với `createCustomer`, account/role/History.
2. RTDB Security Rules giới hạn quyền đọc/ghi trực tiếp.
3. Frontend lọc tab, nút và route theo role để có trải nghiệm đúng.

Ẩn tab hoặc nút trên frontend không được xem là biện pháp bảo mật.

## 5. Thiết kế Firebase Authentication

### 5.1 Provider

- Dùng Email/Password trong giai đoạn đầu.
- Thay `admin/admin` bằng `signInWithEmailAndPassword()`.
- Dùng `onAuthStateChanged()` làm nguồn trạng thái đăng nhập.
- Không tự lưu object session nghiệp vụ vào `localStorage`.
- Khi đổi role, client phải gọi `getIdToken(true)` hoặc đăng nhập lại để nhận custom claims mới.

### 5.2 Nguồn quyền

Role được lưu trong custom claims:

```json
{
  "role": "super_admin"
}
```

Hồ sơ hiển thị được lưu ở `/profiles/{uid}`, nhưng trường `role` trong profile chỉ dùng để hiển thị/tìm kiếm. Cloud Functions và Security Rules phải tin `auth.token.role`, không tin role client gửi lên.

Custom claims chỉ được cấp bằng Admin SDK trong môi trường backend có đặc quyền.

### 5.3 Khởi tạo super admin đầu tiên

Quy trình bootstrap một lần:

1. Tạo user đầu tiên bằng Firebase Console hoặc script Admin SDK chạy cục bộ trong môi trường được bảo vệ.
2. Gán custom claim `{ role: "super_admin" }`.
3. Tạo `/profiles/{uid}` tương ứng.
4. Đăng nhập lại để token nhận claim.
5. Kiểm tra tab **Quản lý tài khoản** và **Lịch sử quản trị**.

Không commit service-account JSON vào repository. UI thông thường không cho tự nâng một tài khoản thành `super_admin`. Nên duy trì ít nhất hai super admin và ngăn khóa/xóa/hạ role của super admin cuối cùng.

### 5.4 Tạo tài khoản từ tab Super Admin

Không dùng `createUserWithEmailAndPassword()` trực tiếp trong phiên đăng nhập của super admin vì API client có thể đổi session sang user vừa tạo và không đủ an toàn để cấp role.

Frontend gọi callable function `createAccount`:

```text
Super Admin form
  -> callable createAccount
  -> kiểm tra request.auth.token.role === super_admin
  -> Admin SDK createUser
  -> Admin SDK setCustomUserClaims
  -> ghi /profiles/{uid}
  -> ghi audit ACCOUNT_CREATED
  -> trả profile an toàn về client
```

Các function quản lý tài khoản dự kiến:

- `createAccount`
- `updateAccountProfile`
- `changeAccountRole`
- `setAccountDisabled`
- `resetAccountPassword` hoặc gửi password reset email
- `listAccounts`

Mỗi function phải kiểm tra người gọi là `super_admin`, validate input và ghi audit. Không trả password hash, token hoặc custom claim không cần thiết cho frontend.

## 6. Thiết kế dữ liệu Realtime Database

RTDB là một JSON tree nên dữ liệu phải tương đối phẳng. Không nhúng toàn bộ lịch sử hoặc toàn bộ movement sâu bên trong một product/order.

### 6.1 Cây dữ liệu đề xuất

```text
/config
  /schemaVersion

/profiles/{uid}
  displayName
  email
  role
  disabled
  createdAt
  createdBy
  updatedAt
  updatedBy

/warehouses/default/products/{productId}
/warehouses/default/customers/{customerId}
/warehouses/default/orders/{orderId}
/warehouses/default/orderItems/{orderId}/{itemId}
/warehouses/default/stockMovements/{movementId}
/warehouses/default/notifications/{notificationId}
/warehouses/default/inventoryBalances/{productId}

/indexes/ordersByCustomer/{customerId}/{orderId}
/indexes/ordersByProduct/{productId}/{orderId}
/indexes/movementsByOrder/{orderId}/{movementId}

/counters/orders/{type}/{year}
/operations/{requestId}
/auditOutbox/{requestId}
/auditLogs/{auditId}
/migrations/{migrationId}
```

Dùng `default` làm warehouse ID để không thay đổi phạm vi ứng dụng hiện tại, đồng thời để ngỏ khả năng có nhiều kho trong tương lai.

### 6.2 Product

```json
{
  "id": "product_xxx",
  "sku": "VT-0001",
  "name": "Tên vật tư",
  "unit": "cái",
  "reorderPoint": 10,
  "unitPrice": 0,
  "notes": "",
  "status": "active",
  "createdAt": 0,
  "createdBy": "uid",
  "updatedAt": 0,
  "updatedBy": "uid",
  "version": 1
}
```

Số lượng hiện tại được lưu riêng tại `/inventoryBalances/{productId}` để giao dịch tồn kho nhiều vật tư không phải transaction trên toàn bộ cây product.

### 6.3 Inventory balance

```json
{
  "quantity": 120,
  "updatedAt": 0,
  "updatedBy": "uid",
  "version": 8
}
```

`quantity` không được client cập nhật trực tiếp. Chỉ các function tạo/xóa phiếu hoặc function điều chỉnh tồn kho mới được thay đổi.

### 6.4 Order và order items

`/orders/{orderId}` chỉ lưu thông tin đầu phiếu:

```json
{
  "id": "order_xxx",
  "orderNumber": "PX-0001",
  "type": "Outbound",
  "customerId": "customer_xxx",
  "customerName": "Tên snapshot",
  "partnerName": "",
  "date": "2026-08-21",
  "notes": "",
  "itemCount": 2,
  "status": "completed",
  "createdAt": 0,
  "createdBy": "uid",
  "createdByName": "Admin A"
}
```

`/orderItems/{orderId}/{itemId}` lưu từng dòng và giữ snapshot tên, SKU, đơn vị, đơn giá tại thời điểm lập phiếu.

### 6.5 Index và query

RTDB không phù hợp với việc tải toàn bộ dữ liệu rồi lọc mãi ở client khi dữ liệu tăng. Cần:

- `.indexOn` cho các trường thường query như `createdAt`, `date`, `type`, `customerId`, `actorUid`, `actorRole`, `action` và `targetType`.
- Phân trang phiếu và audit bằng `orderByChild()` kết hợp `limitToLast()`.
- Dùng các path index đã denormalize để tra phiếu theo khách hàng, vật tư và movement theo order.
- Chỉ attach realtime listener ở path/màn hình đang sử dụng; unsubscribe khi unmount.
- Không dùng tìm kiếm substring toàn bộ server như SQL. Tìm kiếm tên/SKU giai đoạn đầu có thể thực hiện trên tập dữ liệu đã phân trang/cache; nếu dữ liệu lớn cần thêm normalized search keys hoặc dịch vụ search riêng.

## 7. Xử lý nghiệp vụ và tính nhất quán

### 7.1 Nguyên tắc chung

- Mọi request mutation có `requestId`/idempotency key duy nhất.
- Function kiểm tra `/operations/{requestId}` để retry không tạo dữ liệu trùng.
- Dùng server timestamp thay vì tin đồng hồ thiết bị.
- Dùng multi-location `update()` cho các fan-out write cần thành công hoặc thất bại cùng nhau.
- Dùng transaction cho dữ liệu có cạnh tranh như counter và tồn kho.
- Function validate schema vì Admin SDK có đặc quyền và không phụ thuộc Security Rules để kiểm tra dữ liệu.

### 7.2 Tạo phiếu

Callable function `createOrder` thực hiện:

1. Xác thực user và role.
2. Validate order number, ngày, khách hàng và item.
3. Kiểm tra idempotency key.
4. Sinh order number/counter tại backend nếu cần bảo đảm duy nhất.
5. Chạy transaction trên `/inventoryBalances` để cập nhật toàn bộ sản phẩm trong phiếu và ngăn tồn âm với phiếu xuất.
6. Tạo `orders`, `orderItems`, `stockMovements`, `notifications` và các index bằng atomic multi-location update.
7. Ghi `auditOutbox` trong cùng operation để audit không bị bỏ quên.
8. Đánh dấu operation `completed` và trả order về client.

Nếu bước fan-out sau transaction tồn kho thất bại, function phải rollback hoặc để operation ở trạng thái có thể được recovery worker hoàn tất. Không được chỉ cập nhật tồn mà thiếu order/movement.

### 7.3 Xóa phiếu

Callable function `deleteOrder` thực hiện:

1. Cho phép mọi tài khoản đã xác thực và đang hoạt động vì tất cả role có toàn quyền nghiệp vụ kho.
2. Đọc order và toàn bộ item hiện tại.
3. Transaction hoàn tác tồn kho.
4. Atomic update xóa order, items, movements, notifications và indexes liên quan.
5. Ghi audit `ORDER_DELETED` với snapshot cần thiết.
6. Đánh dấu operation hoàn tất.

### 7.4 Product và customer

Các action dự kiến:

- `createProduct`, `updateProduct`, `deleteProduct`
- `createCustomer`, `updateCustomer`, `setCustomerStatus`

`createCustomer` chỉ cho phép khi `request.auth.token.role === 'super_admin'`. Các role khác được đọc/chọn khách hàng đã có nhưng callable function phải từ chối tạo mới kể cả khi họ gọi API thủ công.

Các action còn lại kiểm tra tài khoản đã xác thực và đang hoạt động, validate, gắn `createdBy/updatedBy`, dùng server timestamp và tạo audit outbox.

## 8. Audit log dành cho Super Admin

### 8.1 Phạm vi audit

Audit bắt buộc với các mutation:

- Tạo, sửa, xóa vật tư.
- Tạo và xóa phiếu nhập/xuất.
- Thêm, sửa, đổi trạng thái khách hàng.
- Tạo tài khoản.
- Đổi role tài khoản.
- Khóa/mở tài khoản.
- Reset mật khẩu do quản trị viên yêu cầu, nhưng không ghi mật khẩu.
- Chạy migration hoặc tác vụ sửa dữ liệu.

Các action đọc dữ liệu, mở tab, tìm kiếm và xuất file chưa cần audit ở giai đoạn đầu.

### 8.2 Cấu trúc audit record

```json
{
  "id": "audit_xxx",
  "requestId": "uuid",
  "action": "PRODUCT_UPDATED",
  "actorUid": "firebase-uid",
  "actorEmail": "admin@example.com",
  "actorName": "Nguyễn Văn A",
  "actorRoleAtTime": "admin",
  "targetType": "product",
  "targetId": "product_xxx",
  "targetLabel": "VT-0001 - Tên vật tư",
  "changedFields": ["unitPrice", "notes"],
  "before": {
    "unitPrice": 10000,
    "notes": "Cũ"
  },
  "after": {
    "unitPrice": 12000,
    "notes": "Mới"
  },
  "metadata": {
    "source": "web",
    "warehouseId": "default"
  },
  "createdAt": 0
}
```

### 8.3 Quy tắc audit

- `actorUid`, email và role lấy từ token/backend, không nhận từ form client.
- `actorRoleAtTime` được lưu cố định để lịch sử không thay đổi khi user đổi role.
- `before`, `after` và `changedFields` được tính ở backend.
- Chỉ lưu field nghiệp vụ cần thiết; loại bỏ password, token, secret và dữ liệu nhạy cảm.
- Audit là append-only; không cung cấp API sửa/xóa trên ứng dụng.
- Client không có quyền write vào `/auditLogs` hoặc `/auditOutbox`.
- `super_admin` có quyền read audit; các role khác bị từ chối cả khi gọi URL/path trực tiếp.
- Khi log tăng lớn, phân trang và thiết lập chính sách lưu trữ/archive thay vì tải toàn bộ.

### 8.4 Cách bảo đảm không mất audit

Mutation function ghi một event vào `/auditOutbox/{requestId}` cùng operation nghiệp vụ. Một RTDB-triggered function chuyển event thành `/auditLogs/{auditId}` theo cách idempotent, sau đó đánh dấu outbox đã xử lý.

Thiết kế này giúp retry an toàn và tránh phụ thuộc vào việc frontend tự ghi log. Cần có job/health check phát hiện outbox bị treo.

### 8.5 Tab Lịch sử quản trị

Tab chỉ xuất hiện với `super_admin` và route vẫn phải có guard. Đây là role duy nhất được đọc History; `admin`, `warehouse_manager`, `staff` và `user` đều bị từ chối dù họ có toàn quyền nghiệp vụ kho.

Chức năng màn hình:

- Mặc định lọc `actorRoleAtTime = admin` để trả lời câu hỏi “admin đã làm gì”.
- Có thể chuyển sang xem action của tất cả tài khoản vì mọi role đều có thể thay đổi dữ liệu nghiệp vụ.
- Lọc theo tài khoản, role, action, loại dữ liệu và khoảng ngày.
- Hiển thị thời gian, người thao tác, action, đối tượng và mô tả ngắn.
- Mở drawer/modal chi tiết để so sánh **Trước thay đổi** và **Sau thay đổi**.
- Phân trang theo `createdAt`; không tải toàn bộ audit một lần.
- Không có nút sửa/xóa audit.

## 9. Tab Quản lý tài khoản

Tab chỉ dành cho `super_admin`.

### 9.1 Danh sách

Hiển thị:

- Họ tên.
- Email.
- Role.
- Trạng thái hoạt động/đã khóa.
- Ngày tạo.
- Người tạo.
- Lần đăng nhập gần nhất nếu lấy được từ Admin SDK.

### 9.2 Form thêm tài khoản

Các field:

- Họ tên.
- Email.
- Role: `admin`, `warehouse_manager`, `staff`, `user`.
- Mật khẩu tạm hoặc lựa chọn gửi email đặt mật khẩu.
- Trạng thái kích hoạt.

Không mở tùy chọn `super_admin` trong form mặc định. Nếu cần thêm super admin, dùng flow riêng có xác nhận mạnh và bảo vệ “super admin cuối cùng”.

### 9.3 Action quản trị tài khoản

- Tạo tài khoản.
- Đổi tên hiển thị.
- Đổi role.
- Khóa/mở tài khoản.
- Gửi reset password.
- Không cho user tự khóa chính mình nếu đó là super admin cuối cùng.
- Không xóa cứng profile ở giai đoạn đầu; ưu tiên `disabled` để giữ liên kết audit.

## 10. Security Rules đề xuất

File dự kiến: `database.rules.json`.

Nguyên tắc:

- Mặc định deny.
- Business data cho mọi user đã xác thực đọc được; mutation nghiệp vụ kho cho mọi role đã đăng nhập thông qua Cloud Functions, ngoại trừ `createCustomer` chỉ dành cho `super_admin`.
- Các mutation nghiệp vụ quan trọng không cho client write trực tiếp; client gọi Cloud Functions.
- Profile chỉ chủ tài khoản hoặc `super_admin` đọc; danh sách profile đầy đủ lấy qua callable function nếu cần.
- Audit chỉ `super_admin` đọc, client không ai được write.
- Khai báo `.indexOn` cho query thực tế.

Khung rules ban đầu:

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "warehouses": {
      "$warehouseId": {
        "products": {
          ".read": "auth != null",
          ".write": false,
          ".indexOn": ["sku", "name", "updatedAt"]
        },
        "customers": {
          ".read": "auth != null",
          ".write": false,
          ".indexOn": ["name", "status", "updatedAt"]
        },
        "orders": {
          ".read": "auth != null",
          ".write": false,
          ".indexOn": ["type", "date", "customerId", "createdAt"]
        },
        "orderItems": {
          ".read": "auth != null",
          ".write": false
        },
        "stockMovements": {
          ".read": "auth != null",
          ".write": false,
          ".indexOn": ["orderId", "productId", "date", "createdAt"]
        },
        "inventoryBalances": {
          ".read": "auth != null",
          ".write": false
        }
      }
    },

    "profiles": {
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || auth.token.role === 'super_admin')",
        ".write": false
      }
    },

    "auditLogs": {
      ".read": "auth != null && auth.token.role === 'super_admin'",
      ".write": false,
      ".indexOn": ["actorUid", "actorRoleAtTime", "action", "targetType", "createdAt"]
    },

    "auditOutbox": {
      ".read": false,
      ".write": false
    },

    "operations": {
      ".read": false,
      ".write": false
    }
  }
}
```

Đây là khung thiết kế, chưa phải rules production hoàn chỉnh. Khi triển khai phải test bằng Firebase Emulator Suite với từng role và từng path.

## 11. Tổ chức code dự kiến

```text
src/
  lib/
    firebase.js
  services/
    authService.js
    databaseService.js
    productService.js
    customerService.js
    orderService.js
    accountService.js
    auditService.js
  stores/
    authStore.js
    appStore.js
  components/
    auth/
      Login.jsx
      RequireRole.jsx
    admin/
      AccountManager.jsx
      AccountForm.jsx
      AdminAudit.jsx
      AuditDetail.jsx

functions/
  package.json
  src/
    index.js
    auth/
      accounts.js
      permissions.js
    inventory/
      products.js
      orders.js
      customers.js
    audit/
      writer.js
      outbox.js
    shared/
      validation.js
      idempotency.js

scripts/
  migrate-local-to-rtdb.mjs
  bootstrap-super-admin.mjs

database.rules.json
firebase.json
```

Tên và số file có thể điều chỉnh khi implement, nhưng phải giữ ranh giới: UI không chứa Admin SDK và không nắm service-account credential.

## 12. Refactor frontend

### 12.1 Auth state

- Tạo `authStore` theo dõi `onAuthStateChanged()`.
- Đọc ID token result để lấy role.
- App có trạng thái `authLoading` trước khi quyết định hiển thị Login hay Shell.
- Logout dùng Firebase `signOut()`.
- Shell hiển thị tên, email và role thật.

### 12.2 Navigation và route guard

Mở rộng cấu hình nav:

```js
{ id: 'accounts', label: 'Quản lý tài khoản', roles: ['super_admin'] }
{ id: 'admin-audit', label: 'Lịch sử quản trị', roles: ['super_admin'] }
```

`Shell` lọc item theo role. `App` hoặc router phải kiểm tra role một lần nữa để người dùng không mở route bằng URL hoặc state thủ công.

Ở màn hình Khách hàng và form tạo phiếu xuất, nút/form **Thêm khách hàng** chỉ render với `super_admin`. Các role khác vẫn xem, tìm kiếm, lọc và chọn khách hàng đã có; nếu thiếu khách hàng, UI hướng dẫn liên hệ super admin.

### 12.3 Data store

- Loại bỏ `loadData()` và `persist()` cho dữ liệu nghiệp vụ.
- Tách listener theo domain thay vì một listener tải toàn bộ root.
- MobX cập nhật từ snapshot RTDB.
- Mutation methods trở thành async và gọi service/callable function.
- UI có loading, success, error và retry rõ ràng.
- Dọn listener khi logout hoặc component/store bị dispose.

### 12.4 Trạng thái kết nối

- Dùng `/.info/connected` để hiển thị Online/Offline thay cho nhãn “Local data”.
- Không báo “đã lưu” khi callable function chưa thành công.
- Request có idempotency key để bấm retry không tạo phiếu trùng.

## 13. Chiến lược offline cho PWA

RTDB Web hỗ trợ xử lý mất kết nối tạm thời và đồng bộ lại trong phiên, nhưng thiết kế mọi mutation qua callable function không tự tạo hàng đợi bền vững qua lần đóng trình duyệt.

Chọn một trong hai mức triển khai:

### Mức 1 — đề xuất cho lần chuyển đổi đầu tiên

- Khi offline, cho xem snapshot gần nhất đã cache trong IndexedDB.
- Các thao tác tạo/sửa/xóa bị khóa và hiển thị lý do cần kết nối mạng.
- Khi online lại, attach listener và đồng bộ dữ liệu mới.

### Mức 2 — nếu bắt buộc lập phiếu khi offline

- Lưu command vào IndexedDB outbox.
- Mỗi command có `requestId`, payload, actor UID, thời gian client và trạng thái.
- Khi online, replay qua callable function.
- Backend dùng idempotency để chống trùng.
- UI phân biệt “Đang chờ đồng bộ” và “Đã lưu trên server”.
- Xử lý conflict nếu tồn kho thay đổi trong lúc thiết bị offline.

Không tiếp tục coi `localStorage` là database offline chính vì giới hạn dung lượng, thao tác nguyên khối và khó xử lý xung đột.

## 14. Kế hoạch migration dữ liệu local

### 14.1 Nguyên tắc

- Chọn một thiết bị/trình duyệt làm nguồn dữ liệu chuẩn.
- Không để mọi thiết bị tự upload local data vì sẽ tạo bản ghi trùng hoặc tồn kho sai.
- Export key `qlkh-local-data-v1` ra JSON trước khi thay đổi.
- Tạo checksum và migration ID cho file nguồn.
- Migration chạy bằng Admin SDK/script bảo vệ, không chạy bằng quyền client.
- Giữ file backup gốc và báo cáo đối soát sau import.

### 14.2 Chuẩn hóa trước import

- Kiểm tra trùng SKU.
- Chuẩn hóa tên khách hàng để phát hiện bản ghi trùng.
- Kiểm tra trùng `orderNumber`.
- Kiểm tra order item tham chiếu product tồn tại.
- Loại hoặc báo cáo movement mồ côi.
- Giữ snapshot name/SKU/unit/unitPrice trong order item.
- Chuyển timestamp/ngày về định dạng thống nhất.
- Gắn `createdBy = migration` khi dữ liệu cũ không có actor.
- Ghi audit `DATA_MIGRATED` với tổng số record, checksum và migration ID.

### 14.3 Tồn kho

Số lượng hiện tại trong `products[].quantity` được lấy làm số dư tại thời điểm cutover và ghi vào `/inventoryBalances/{productId}`.

Movement lịch sử được import để phục vụ thống kê, nhưng không chạy lại toàn bộ movement để cộng/trừ lần nữa. Báo cáo migration phải so sánh:

- Tổng số loại vật tư.
- Tổng quantity trước/sau.
- Tổng phiếu nhập/xuất.
- Tổng movement.
- Tổng khách hàng.
- Số order item lỗi hoặc tham chiếu mồ côi.

### 14.4 Cutover

1. Đóng băng ghi dữ liệu local trong khoảng cutover.
2. Export JSON backup cuối cùng.
3. Chạy dry-run và xem báo cáo.
4. Chạy import chính thức.
5. Đối soát tổng số và kiểm tra mẫu phiếu.
6. Bật `VITE_DATA_BACKEND=firebase`.
7. Theo dõi error, outbox và audit trong thời gian đầu.
8. Giữ local backup ở chế độ chỉ đọc cho đến khi nghiệm thu.

Không dual-write local và Firebase kéo dài vì hai nguồn có thể lệch nhau. Feature flag chỉ dùng để rollback trong giai đoạn triển khai.

## 15. Các phase triển khai

### Phase 0 — Chốt yêu cầu và backup

- Chốt ma trận role.
- Chốt chính sách offline mức 1 hay mức 2.
- Chọn thiết bị chứa dữ liệu chuẩn.
- Export và kiểm tra backup local.
- Chốt Firebase project, region RTDB và Functions cùng khu vực phù hợp.

**Điều kiện hoàn thành:** có backup đọc được, role matrix được duyệt và biết rõ source of truth.

### Phase 1 — Firebase foundation và emulator

- Thêm Firebase initialization qua biến môi trường Vite.
- Bổ sung Auth, Database, Functions và Emulator config vào `firebase.json`.
- Tạo `database.rules.json` mặc định deny.
- Tạo Functions project và shared validation.
- Không đưa service-account credential vào client/repository.

**Điều kiện hoàn thành:** app kết nối emulator và production config tách biệt.

### Phase 2 — Authentication và RBAC

- Thay login cứng bằng Firebase Auth.
- Tạo auth store và token-role loading.
- Bootstrap super admin.
- Implement permission helpers dùng chung.
- Lọc navigation và guard page/action.
- Test custom claim refresh sau đổi role.

**Điều kiện hoàn thành:** từng role đăng nhập và thực hiện đầy đủ nghiệp vụ kho; chỉ `super_admin` tạo được khách hàng mới, quản lý tài khoản/role và truy cập History.

### Phase 3 — Schema RTDB và data service

- Implement các path/schema đã chốt.
- Thêm query/index cần thiết.
- Tạo listener theo domain.
- Refactor MobX bỏ persist toàn bộ object.
- Hiển thị trạng thái kết nối realtime.

**Điều kiện hoàn thành:** dữ liệu từ emulator render đầy đủ và cập nhật giữa hai trình duyệt.

### Phase 4 — Mutation Functions và tính nhất quán

- Implement product/customer functions.
- Implement `createOrder` và `deleteOrder` với transaction, fan-out và idempotency.
- Implement operation recovery.
- Chặn tồn kho âm do request đồng thời.
- Tạo audit outbox cho mọi mutation.

**Điều kiện hoàn thành:** test đồng thời không tạo order trùng, không sai tồn và không để movement mồ côi.

### Phase 5 — Audit và quản lý tài khoản

- Implement account management functions.
- Implement audit outbox processor.
- Thêm tab **Quản lý tài khoản**.
- Thêm tab **Lịch sử quản trị**.
- Thêm filter, pagination và before/after detail.
- Bảo vệ super admin cuối cùng.

**Điều kiện hoàn thành:** super admin quản lý account và xem được đầy đủ thay đổi do mọi tài khoản thực hiện; tất cả role còn lại không đọc được hai tab/path này.

### Phase 6 — Migration và đối soát

- Viết migration script và dry-run report.
- Import dữ liệu mẫu vào emulator.
- Sửa dữ liệu lỗi/mồ côi.
- Import production trong cửa sổ cutover.
- Đối soát số liệu và chứng từ mẫu.

**Điều kiện hoàn thành:** tổng tồn, phiếu, movement và khách hàng khớp báo cáo nguồn.

### Phase 7 — Kiểm thử, deploy và theo dõi

- Chạy test Auth/Rules/Functions/UI.
- Deploy rules trước khi mở app production.
- Deploy Functions và Hosting.
- Bật App Check cho callable functions khi ổn định.
- Theo dõi lỗi, chi phí, audit outbox và operation pending.
- Xác nhận rollback procedure.

**Điều kiện hoàn thành:** nghiệm thu bảo mật, dữ liệu, realtime và recovery.

## 16. Kế hoạch kiểm thử

### 16.1 Authentication/RBAC

- Chưa đăng nhập không đọc được business data.
- `admin` không gọi được account functions.
- `admin` không đọc được `/auditLogs`.
- `super_admin` xem được account/audit.
- `super_admin` tạo khách hàng mới thành công.
- `admin`, `warehouse_manager`, `staff` và `user` không gọi được `createCustomer`, kể cả gọi callable function thủ công.
- Tất cả role đều xem/chọn được khách hàng đã có khi tạo phiếu.
- `admin`, `warehouse_manager`, `staff` và `user` đều thêm/sửa/xóa được product và order.
- `warehouse_manager`, `staff` và `user` không đọc được `/auditLogs`.
- Thay role có hiệu lực sau token refresh.
- Không thể tự ghi role vào profile để nâng quyền.

### 16.2 Audit

- Mỗi create/update/delete sinh đúng một audit record dù client retry.
- Update ghi đúng changed fields, before và after.
- Delete giữ snapshot đủ để tra cứu.
- Không log password/token.
- Client không sửa/xóa audit.
- Filter theo tài khoản/role/action/ngày trả đúng kết quả.
- Outbox bị gián đoạn có thể retry không tạo log trùng.

### 16.3 Kho và phiếu

- Tạo phiếu nhập cộng tồn đúng.
- Tạo phiếu xuất trừ tồn đúng.
- Không cho xuất vượt tồn nếu chính sách yêu cầu.
- Hai tài khoản tạo phiếu đồng thời không làm mất update.
- Retry request không tạo hai phiếu.
- Xóa phiếu hoàn tồn và xóa mọi dữ liệu/index liên quan.
- Statistics cập nhật realtime sau tạo/xóa.

### 16.4 Migration

- Import lại cùng migration ID không tạo dữ liệu trùng.
- Tổng quantity trước/sau khớp.
- Order item không mất snapshot.
- Movement mồ côi được báo cáo.
- Dữ liệu Unicode tiếng Việt không lỗi.
- File backup local có thể dùng để rollback/đối chiếu.

### 16.5 UI/PWA

- Hai tab super admin không xuất hiện với role khác, dù các role đó có toàn quyền nghiệp vụ kho.
- Nút/form thêm khách hàng không xuất hiện với role khác; backend vẫn từ chối nếu gọi API thủ công.
- Mở route trái quyền bị chuyển hướng hoặc báo 403.
- Listener được cleanup sau logout.
- Mất mạng hiển thị đúng trạng thái.
- Không báo thành công khi server chưa xác nhận.
- Mobile sidebar vẫn hiển thị đúng theo role.

## 17. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| RTDB query hạn chế khi lọc nhiều điều kiện | Denormalized indexes, pagination và không tải toàn bộ root |
| Hai người cập nhật tồn cùng lúc | Transaction trên inventory balances và idempotent operation |
| Nghiệp vụ thành công nhưng thiếu audit | Audit outbox + trigger retry + health check |
| Client tự nâng role | Custom claims chỉ set bằng Admin SDK; rules/functions đọc role từ token |
| Tạo account từ client làm đổi session | Tạo user qua callable function + Admin SDK |
| Role mới chưa có trong token | Force refresh ID token hoặc yêu cầu đăng nhập lại |
| Audit tăng nhanh | Pagination, index, retention/archive và không lưu payload dư thừa |
| Dữ liệu local khác nhau giữa các máy | Chỉ định một nguồn chuẩn và import một lần |
| Offline write qua Functions không tự replay bền vững | Mức 1 read-only offline hoặc IndexedDB outbox ở mức 2 |
| Function và RTDB khác region | Chọn location tương thích ngay từ Phase 0 |
| Chi phí Cloud Functions/RTDB | Bật budget alert, giới hạn listener và đo read/write thực tế |

## 18. Tiêu chí nghiệm thu cuối cùng

- Không còn login cứng `admin/admin` trong production.
- Dữ liệu nghiệp vụ mới không còn ghi vào `qlkh-local-data-v1`.
- Hai thiết bị thấy thay đổi kho/phiếu realtime.
- Backend cho mọi role đã xác thực thực hiện nghiệp vụ kho, nhưng từ chối tạo khách hàng, account/role/History nếu không phải `super_admin`.
- Chỉ super admin thấy và truy cập hai tab quản trị mới.
- Super admin tạo, khóa, mở và đổi role account được.
- Mỗi action thêm/sửa/xóa quan trọng có audit chứa actor, thời gian, target và before/after phù hợp.
- Admin không thể sửa/xóa audit hoặc tự cấp quyền.
- Tạo/xóa phiếu không làm sai tồn hoặc để dữ liệu liên quan mồ côi.
- Migration production có backup và báo cáo đối soát đạt yêu cầu.
- Rules và Functions đã được kiểm thử trên Emulator Suite trước deploy.

## 19. Thứ tự ưu tiên triển khai

Thứ tự không nên đảo:

1. Backup và chốt role.
2. Auth + custom claims + super admin bootstrap.
3. Rules mặc định deny và Functions foundation.
4. RTDB read/listeners.
5. Mutation nghiệp vụ qua Functions.
6. Audit outbox/log.
7. Quản lý tài khoản và hai tab super admin.
8. Migration production.
9. Mở realtime production và theo dõi.

Không migrate dữ liệu production trước khi account functions, rules, audit và create/delete order đã vượt qua test emulator.

## 20. Tài liệu Firebase tham chiếu

- [Structure Your Database](https://firebase.google.com/docs/database/web/structure-data)
- [Read and Write Data on the Web](https://firebase.google.com/docs/database/web/read-and-write)
- [Realtime Database Security Rules](https://firebase.google.com/docs/database/security)
- [Index Your Data](https://firebase.google.com/docs/database/security/indexing-data)
- [Manage Users with Firebase Admin SDK](https://firebase.google.com/docs/auth/admin/manage-users)
- [Custom Claims and Security Rules](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Callable Cloud Functions](https://firebase.google.com/docs/functions/callable)
- [Realtime Database Triggers](https://firebase.google.com/docs/functions/database-events)
- [Realtime Database Offline Capabilities for Web](https://firebase.google.com/docs/database/web/offline-capabilities)
