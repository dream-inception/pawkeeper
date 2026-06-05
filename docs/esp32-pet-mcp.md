# ESP32 控制 Pawkeeper 宠物协议

本文档说明如何用 ESP32 控制 Pawkeeper 桌面宠物。项目里的服务名叫 MCP 控制服务，但对 ESP32 这类微控制器，推荐使用同一个服务暴露的简单 HTTP `/state` 端点；完整 MCP Streamable HTTP `/mcp` 端点主要给 Cursor 和 AI Agent 使用。

## 总览

Pawkeeper 在电脑端启动一个本地 HTTP 服务，负责接收宠物控制指令并转发给 Electron 宠物窗口。

默认端点：

| 端点 | 默认 URL | 认证 | 用途 |
| --- | --- | --- | --- |
| 健康检查 | `http://127.0.0.1:8765/health` | 不需要 | 判断服务是否启动 |
| 简单状态控制 | `http://127.0.0.1:8765/state` | 默认不需要；生成 token 后需要 | 给脚本、ESP32、局域网设备控制宠物 |
| MCP Streamable HTTP | `http://127.0.0.1:8765/mcp` | 默认不需要；生成 token 后需要 | 给 Cursor 或其他 MCP 客户端调用工具 |

端口默认是 `8765`。如果电脑端口被占用，Pawkeeper 会自动换到随机端口，实际地址以设置页显示为准。

## ESP32 推荐架构

ESP32 不需要实现 MCP 协议。推荐链路是：

```text
ESP32 -> Wi-Fi LAN -> Pawkeeper 电脑端 /state -> Electron 主进程 -> 桌面宠物窗口
```

原因：

- MCP Streamable HTTP 需要 MCP 客户端协议、工具列表、JSON-RPC 风格消息和流式传输处理，ESP32 上实现成本高。
- `/state` 是同一个控制服务的轻量 HTTP JSON 接口，功能覆盖宠物动画控制、读取状态、清除 MCP 控制。
- mDNS 广播仍然可用，ESP32 可以通过 `_mcp._tcp` 服务发现电脑端地址，并从 TXT 记录里读取 `statePath=/state`。

## 电脑端准备

1. 打开 Pawkeeper 设置。
2. 在 Cat / Agent control 区域开启 `Enable MCP control`。
3. 如果 ESP32 和电脑在同一局域网，开启 `Allow LAN access via mDNS`。
4. 记下设置页显示的 LAN State URL，例如：

```text
http://neko.local:8765/state
http://192.168.1.20:8765/state
```

5. 默认不需要 token，ESP32 可以直接调用。需要安全限制时，点击 `Generate Token` 后再把 bearer token 加到 ESP32 请求里。

如果 `.local` 域名解析不稳定，优先使用设置页显示的 IP URL。

## 认证

默认不需要认证，便于局域网调试。生成 token 后，除 `/health` 外的控制端点都需要认证。支持两种方式：

```http
Authorization: Bearer YOUR_TOKEN
```

或：

```http
X-Pawkeeper-Token: YOUR_TOKEN
```

推荐 ESP32 使用 `Authorization` 请求头。token 由电脑端生成，点击 `Generate Token` / `Regenerate Token` 后旧 token 立即失效。

## `/health` 健康检查

请求：

```http
GET /health HTTP/1.1
Host: 192.168.1.20:8765
```

成功响应：

```json
{
  "ok": true,
  "service": "pawkeeper-pet",
  "mcp": "/mcp",
  "state": "/state"
}
```

用途：

- ESP32 启动后确认电脑端服务是否在线。
- 不需要 token，适合做网络连通性测试。

## `/state` 状态控制 API

### 读取当前状态

请求：

```http
GET /state HTTP/1.1
Host: 192.168.1.20:8765
```

响应示例：

```json
{
  "state": "waving",
  "source": "mcp",
  "priority": 40,
  "message": "Hello",
  "playCount": 3,
  "updatedAt": 1779277200000,
  "expiresAt": 1779277204200,
  "availableStates": [
    "idle",
    "runningRight",
    "runningLeft",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review"
  ],
  "petEnabled": true,
  "activePet": {
    "id": "example-pet",
    "displayName": "Example Pet"
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `state` | string | 当前动画状态 |
| `source` | string | 当前状态来源，ESP32 设置后通常是 `mcp` |
| `priority` | number | 状态优先级，`mcp` 最高，为 `40` |
| `message` | string | 宠物气泡文字，最长 120 字符 |
| `playCount` | number | 指定动画循环次数，`0` 表示未指定 |
| `updatedAt` | number | 状态更新时间，Unix 毫秒时间戳 |
| `expiresAt` | number/null | 状态过期时间，`null` 表示持续保持 |
| `availableStates` | string[] | 当前支持的动画状态 |
| `petEnabled` | boolean | 桌面宠物是否启用 |
| `activePet` | object/null | 当前 Codex 宠物信息 |

### 设置宠物状态

请求：

```http
POST /state HTTP/1.1
Host: 192.168.1.20:8765
Content-Type: application/json

{
  "state": "waving",
  "playCount": 3,
  "message": "ESP32 online"
}
```

请求体字段：

| 字段 | 类型 | 必填 | 范围 | 说明 |
| --- | --- | --- | --- | --- |
| `state` | string | 否 | 见状态表 | 目标动画。省略时默认为 `waving` |
| `durationMs` | number | 否 | `1` 到 `600000` | 状态保持毫秒数，最长 10 分钟 |
| `playCount` | number | 否 | `1` 到 `100` | 动画播放循环次数 |
| `message` | string | 否 | 最长 120 字符 | 宠物气泡文字 |

`durationMs` 和 `playCount` 的关系：

- 如果传了 `durationMs`，状态保持到指定时间后自动恢复。
- 如果没有传 `durationMs`，但传了 `playCount`，电脑端会根据动画帧时长估算过期时间。
- 如果两者都不传，`mcp` 状态会持续保持，直到 ESP32 发送 `DELETE /state` 或其他 MCP 控制覆盖它。

成功响应与 `GET /state` 结构相同，返回设置后的当前状态。

### 清除 ESP32/MCP 控制

请求：

```http
DELETE /state HTTP/1.1
Host: 192.168.1.20:8765
```

如果你在 Pawkeeper 设置里生成了 token，上面这些 `/state` 请求都需要额外加上：

```http
Authorization: Bearer YOUR_TOKEN
```

清除后，宠物回到鼠标互动、计时器提醒或 idle 状态。

## 动画状态表

| 状态 | 别名 | 建议用途 |
| --- | --- | --- |
| `idle` | 无 | 空闲 |
| `runningRight` | `running-right` | 右跑，表示执行中或向右移动 |
| `runningLeft` | `running-left` | 左跑，表示执行中或向左移动 |
| `waving` | 无 | 打招呼、完成、确认收到 |
| `jumping` | 无 | 成功、提醒、事件触发 |
| `failed` | 无 | 错误、传感器异常、请求失败 |
| `waiting` | 无 | 等待用户、等待网络、待机 |
| `running` | 无 | ESP32 正在处理任务 |
| `review` | 无 | 检查中、审核中、读取传感器数据 |

## 状态优先级

Pawkeeper 内部按来源选择最终显示状态：

| 来源 | 优先级 |
| --- | --- |
| `idle` | 0 |
| `mouse` | 10 |
| `timer` | 20 |
| `user` | 30 |
| `mcp` | 40 |

ESP32 通过 `/state` 设置的状态来源是 `mcp`，优先级最高。因此，如果 ESP32 设置了一个没有过期时间的状态，宠物会一直保持该状态。建议 ESP32 大多数指令都带 `durationMs` 或 `playCount`。

## mDNS 服务发现

开启 LAN/mDNS 后，电脑端发布：

| 项 | 值 |
| --- | --- |
| 服务名 | `Pawkeeper Pet` |
| 服务类型 | `_mcp._tcp` |
| 协议 | TCP |
| TXT `app` | `pawkeeper` |
| TXT `mcpPath` | `/mcp` |
| TXT `statePath` | `/state` |
| TXT `healthPath` | `/health` |
| TXT `auth` | 默认 `none`，生成 token 后为 `bearer` |

ESP32 可以用 mDNS 查找 `_mcp._tcp`，再拼出：

```text
http://<host>:<port><statePath>
```

如果 ESP32 的 mDNS 解析不稳定，可以把电脑 IP 和端口写进 ESP32 配置。实际部署中，给电脑设置 DHCP 静态租约通常更可靠。

## Arduino ESP32 示例

下面示例使用 Arduino core for ESP32 的 `WiFi.h` 和 `HTTPClient.h`。把 `WIFI_SSID`、`WIFI_PASSWORD` 和 `PET_STATE_URL` 改成你的值；只有在 Pawkeeper 设置里生成了 token 时才需要填写 `PET_TOKEN`。

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* PET_STATE_URL = "http://192.168.1.20:8765/state";
const char* PET_TOKEN = "";

bool sendPetState(const char* state, const char* message, int playCount, int durationMs) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(PET_STATE_URL);
  http.addHeader("Content-Type", "application/json");
  if (PET_TOKEN[0] != '\0') {
    http.addHeader("Authorization", String("Bearer ") + PET_TOKEN);
  }

  String body = "{";
  body += "\"state\":\"";
  body += state;
  body += "\"";
  if (message && message[0] != '\0') {
    body += ",\"message\":\"";
    body += message;
    body += "\"";
  }
  if (playCount > 0) {
    body += ",\"playCount\":";
    body += playCount;
  }
  if (durationMs > 0) {
    body += ",\"durationMs\":";
    body += durationMs;
  }
  body += "}";

  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("Pawkeeper status=%d response=%s\n", statusCode, response.c_str());
  return statusCode >= 200 && statusCode < 300;
}

bool clearPetState() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(PET_STATE_URL);
  if (PET_TOKEN[0] != '\0') {
    http.addHeader("Authorization", String("Bearer ") + PET_TOKEN);
  }
  int statusCode = http.sendRequest("DELETE");
  http.end();
  return statusCode >= 200 && statusCode < 300;
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected");

  sendPetState("waving", "ESP32 online", 3, 0);
}

void loop() {
  // 示例：每 30 秒让宠物进入 waiting 两秒。
  sendPetState("waiting", "Sensor idle", 0, 2000);
  delay(30000);
}
```

注意：示例里的 JSON 拼接适用于固定 ASCII 文案。若 message 来自外部输入，需要先做 JSON 字符串转义，避免引号或反斜杠破坏请求体。

## ESP-IDF 示例

下面是 ESP-IDF 风格的最小 POST 示例，适合放在 Wi-Fi 已连接后的任务中。

```c
#include "esp_http_client.h"
#include "esp_log.h"

static const char *TAG = "pawkeeper";
static const char *PET_STATE_URL = "http://192.168.1.20:8765/state";
static const char *PET_TOKEN = "";

esp_err_t pawkeeper_set_state(const char *state, const char *message, int play_count, int duration_ms) {
    char body[256];
    int written = snprintf(
        body,
        sizeof(body),
        "{\"state\":\"%s\",\"message\":\"%s\",\"playCount\":%d,\"durationMs\":%d}",
        state,
        message ? message : "",
        play_count,
        duration_ms
    );

    if (written < 0 || written >= sizeof(body)) {
        return ESP_ERR_NO_MEM;
    }

    esp_http_client_config_t config = {
        .url = PET_STATE_URL,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 3000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    if (PET_TOKEN[0] != '\0') {
        char auth_header[96];
        snprintf(auth_header, sizeof(auth_header), "Bearer %s", PET_TOKEN);
        esp_http_client_set_header(client, "Authorization", auth_header);
    }
    esp_http_client_set_post_field(client, body, strlen(body));

    esp_err_t err = esp_http_client_perform(client);
    int status = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "Pawkeeper HTTP status=%d err=%s", status, esp_err_to_name(err));
    esp_http_client_cleanup(client);

    if (err != ESP_OK) {
        return err;
    }
    return status >= 200 && status < 300 ? ESP_OK : ESP_FAIL;
}
```

## 建议的 ESP32 事件映射

| ESP32 事件 | 推荐状态 | 请求体示例 |
| --- | --- | --- |
| 设备上线 | `waving` | `{"state":"waving","playCount":3,"message":"ESP32 online"}` |
| 正在连接 Wi-Fi | `waiting` | `{"state":"waiting","durationMs":5000,"message":"Connecting Wi-Fi"}` |
| 正在读取传感器 | `review` | `{"state":"review","durationMs":3000,"message":"Reading sensor"}` |
| 继电器/舵机动作中 | `running` | `{"state":"running","durationMs":3000,"message":"Actuating"}` |
| 检测到目标事件 | `jumping` | `{"state":"jumping","playCount":2,"message":"Detected"}` |
| 命令执行成功 | `waving` | `{"state":"waving","playCount":1,"message":"Done"}` |
| 传感器或网络错误 | `failed` | `{"state":"failed","playCount":1,"message":"Error"}` |
| 回到自动行为 | 清除状态 | `DELETE /state` |

## 错误响应

| HTTP 状态 | 含义 | 处理建议 |
| --- | --- | --- |
| `200` | 成功 | 解析响应或忽略 |
| `400` | 请求体不是合法 JSON，或状态名不支持 | 检查 JSON 和 `state` 字段 |
| `401` | 已启用 token，但 token 缺失或错误 | 从设置页重新复制 token，或移除旧请求头 |
| `404` | 路径错误 | 检查是否使用 `/state` |
| `405` | 方法错误 | `/state` 只支持 `GET`、`POST`、`DELETE` |

## 安全建议

- 只在需要 ESP32 控制时开启 `Allow LAN access via mDNS`。
- 默认无 token 时，局域网内可访问该端口的设备都能控制宠物。需要限制访问时，先在 Pawkeeper 设置里生成 token。
- token 不要写进公开仓库。对量产设备，建议通过串口、NVS 配置或配网流程写入。
- ESP32 与电脑应在可信局域网内通信。当前协议是 HTTP 明文，不适合暴露到公网。
- 电脑端防火墙需要允许 Pawkeeper/Electron 接收局域网连接。

## 调试清单

1. 电脑端设置页确认 MCP 服务运行中。
2. ESP32 和电脑连接同一个局域网。
3. 先从另一台电脑或手机用浏览器打开 `http://电脑IP:8765/health`。
4. 用电脑终端验证 `/state`：

```bash
curl -X POST http://电脑IP:8765/state \
  -H "Content-Type: application/json" \
  --data '{"state":"waving","playCount":3,"message":"Hello from curl"}'
```

如果已经生成 token，在 curl 里加上 `-H "Authorization: Bearer YOUR_TOKEN"`。

5. 如果 curl 成功但 ESP32 失败，检查 ESP32 串口日志里的 HTTP 状态码。
6. 如果 `.local` 不通，改用 IP URL。
7. 如果返回 `401`，重新复制 token；如果刚点击过 `Generate Token` / `Regenerate Token`，需要同步更新 ESP32 配置。没有启用 token 时，删除旧的 `Authorization` 请求头。
