# Desktop Pet · Windows 桌面宠物

一款常驻 Windows 系统托盘、可爱可定制的轻量级桌面宠物（Tauri v2 + Rust + React/TypeScript）。
透明无边框、置顶、可拖拽、多动画状态、定时提醒、鼠标交互、自启动，且常驻内存极小。

---

## 环境依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| Windows | 10 1903+ | 内置 WebView2（否则首次运行会引导安装） |
| Rust | ≥ 1.70 | 后端 / 窗口 / 托盘 / 调度 |
| Node.js | ≥ 18 | 前端构建（Vite） |
| Microsoft Edge WebView2 | 运行时 | Tauri v2 渲染内核 |
| Tauri CLI | 随 devDependency 安装 | `npm i` 后自带 `@tauri-apps/cli` |

> 安装 Rust：<https://rustup.rs/> ；Node.js：<https://nodejs.org/>

---

## 安装与运行

```bash
# 1. 安装前端依赖（含 Tauri CLI / Vite / React / vitest）
npm install

# 2. 开发模式（前端热更新 + Rust 编译运行）
npm run tauri dev

# 3. 生产构建（生成安装包到 src-tauri/target/release/）
npm run tauri build

# 4. 仅前端单元测试（状态机 / 提醒 / 配置校验）
npm test

# 5. 仅 Rust 单元测试（状态机 / 调度 / 配置序列化 / 坐标）
cd src-tauri && cargo test
```

首次 `npm run tauri dev` 会：用 `tauri-build` 生成代码与 ACL schema，编译 Rust 后端，
启动 Vite 开发服务器（http://localhost:1420），并由 WebView2 加载。

---

## 已实现功能（需求覆盖 R-01 ~ R-16）

| 需求 | 实现 | 关键文件 |
|------|------|---------|
| R-01 透明/无边框/置顶/无任务栏 | Tauri `transparent`+`decorations:false`+`alwaysOnTop`+`skipTaskbar`，并叠加 `WS_EX_TOOLWINDOW` | `tauri.conf.json`, `src-tauri/src/window/transparent.rs` |
| R-02 拖拽移动 + 持久化 | 宠物命中区 pointer 拖拽 → `window_move` → 松手 `config_save_position` | `src/pet/PetCanvas.tsx`, `commands.rs` |
| R-03 四态动画 | `idle/walk/sleep/play` 精灵帧引擎 + 状态机 | `src/pet/spriteEngine.ts`, `petStateMachine.ts` |
| R-04 托盘常驻 + 显隐 | 托盘菜单（显示/隐藏、设置、立即提醒测试、关于、退出）+ `visibility_changed` | `src-tauri/src/tray/mod.rs` |
| R-05 鼠标交互 + 跟随 | 点击触发 play；`GetCursorPos` 限频轮询 + `mouse_move` 事件 + 限速跟随 | `src-tauri/src/mouse/mod.rs`, `PetCanvas.tsx` |
| R-06 定时提醒 | `ReminderScheduler` 每秒 tick（误差 ≤±2s）→ `reminder_trigger` → Toast | `src-tauri/src/reminder/*`, `src/toast/ToastHost.tsx` |
| R-07 性能基线 | 空闲降帧(2fps)/隐藏暂停/DPI 缩放/跨屏；目标 CPU<1%、内存<50MB、≥30fps | 见下文「性能度量」 |
| R-08 外观自定义 | ≥8 色板 + ≥5 配饰 + 大小滑杆 + 实时预览（含 body 染色） | `src/settings/AppearanceEditor.tsx`, `src/pet/accessories.ts` |
| R-09 设置面板 | 外观/行为/提醒/通用 分页集中管理，持久化 | `src/settings/SettingsPanel.tsx` |
| R-10 提醒管理 | 增/删/改、启停、循环（每日/工作日/周末）、下次触发预览 | `src/settings/ReminderEditor.tsx` |
| R-11 自动状态切换 | 夜间 sleep、移动 walk、点击 play、空闲 idle（策略） | `src/pet/autoPolicy.ts`, `petStateMachine.ts` |
| R-12 开机自启 | 注册表 `Run` 键（默认关） | `src-tauri/src/autostart/mod.rs` |
| R-13 多宠物 | `PetRegistry` / `PetProvider` 接口预留（单宠物） | `src-tauri/src/pet/mod.rs` |
| R-14 音效 | `withSound` 字段 + Toast 轻提示音（WebAudio） | `src/toast/ToastHost.tsx` |
| R-15 心情/成长 | `PetMood` 亲密度/等级 stub（纯逻辑，可扩展） | `src-tauri/src/pet/mod.rs` |
| R-16 云同步 | `SyncProvider` trait + `NullSync` 空实现（Q7 纯本地） | `src-tauri/src/pet/sync.rs` |

---

## 性能度量（R-07）

设计目标：**空闲 CPU < 1% · 内存 < 50MB · 动画 ≥ 30fps**。

实现手段：
- **空闲降帧**：`idle`/`sleep` 状态渲染循环间隔 500ms（≈2fps）；`walk`/`play` 为 33ms（≈30fps）。
- **隐藏暂停**：窗口被托盘隐藏时停止渲染（仅每 500ms 轮询恢复），CPU 接近 0。
- **DPI 缩放**：画布按 `devicePixelRatio` 放大后备缓冲，绘制使用逻辑坐标，清晰且不错位。
- **轻量鼠标轮询**：`GetCursorPos` 33ms 限频（避免 `WH_MOUSE_LL` 全局钩子），仅前端开启“跟随”时生效。
- **小体积二进制**：Rust 后端 + 系统级 WebView2，无内嵌 Chromium。

度量方法（在用户 Windows 机器上）：
1. 打开任务管理器 → 详细信息 → 查看 `desktop-pet.exe` 的 **CPU** 与 **内存**。
2. 空闲静置 1 分钟，CPU 应接近 0%、内存 < 50MB。
3. 用 **Windows Performance Recorder / GPUView** 或浏览器 `requestAnimationFrame` 计数验证 ≥30fps（活动态）。
4. 可用 `cargo build --release` 后 `npm run tauri build`，对比 release 体积与常驻内存。

---

## 工程结构

```
desktop-pet/
├── package.json / vite.config.ts / tsconfig*.json
├── index.html
├── public/pets/            # 前端直接加载的精灵图 + manifest（由源资源复制）
├── assets/accessories/     # 配饰占位图（程序化绘制为主，见 accessories.ts）
├── src/                    # 前端 React + TS
│   ├── main.tsx App.tsx
│   ├── pet/                # PetCanvas / spriteEngine / petStateMachine / autoPolicy / accessories
│   ├── settings/           # SettingsPanel / AppearanceEditor / ReminderEditor
│   ├── toast/ToastHost.tsx
│   ├── store/usePetStore.ts
│   ├── ipc/api.ts
│   ├── lib/                # 纯逻辑（reminder / validate）+ 单测
│   └── types.ts
└── src-tauri/              # Rust 后端
    ├── Cargo.toml build.rs tauri.conf.json capabilities/default.json
    ├── src/main.rs commands.rs
    └── src/{window,tray,reminder,config,mouse,autostart,pet}/
```

---

## 已知限制 / 设计说明

- **`windows` crate 的取舍**：架构文档建议 `windows@^0.52`。由于 Tauri 内部已依赖特定版本的
  `windows`/`windows-sys`，再独立声明一个可能不匹配的主版本会导致**硬编译失败**。本实现改用
  **原生 `extern "system"` FFI**（user32 / gdi32 / advapi32），避免版本冲突，行为与文档一致。
- **点击穿透**：透明区穿透通过前端“命中覆盖层”（`pointer-events` 仅在宠物包围盒上启用）实现，
  可靠且不依赖 WebView 内部命中测试；Rust 端 `WM_NCHITTEST` 子类作为冗余尽力而为（含 WebView2
  子窗口枚举）。
- **配饰资源**：`assets/accessories/` 提供占位 PNG，但前端默认以**程序化绘制**呈现配饰（帽子/
  眼镜/蝴蝶结/围巾/星星/小花），便于后续替换为美术资源。
- **配置位置**：`%APPDATA%/com.desktoppet.app/config.json`（Windows）。
- **多宠物 / 云同步 / 成长**：按 R-13~R-16 仅预留接口与 stub，未做完整 UI。
- **Toast 展示**：在宠物窗口内以轻量 pill 呈现（窗口较小）；如需更大弹窗可后续独立窗口实现。
