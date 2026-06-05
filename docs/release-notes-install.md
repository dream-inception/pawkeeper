## 安装方法 / Installation (macOS, Apple Silicon)

> 适用于 Apple 芯片（M1/M2/M3/M4）的 Mac。
> For Apple Silicon Macs (M1/M2/M3/M4).

### 中文

1. 在下方 **Assets** 中下载 `Pawkeeper-*-arm64.dmg`。
2. 双击打开 DMG，把 **Pawkeeper** 拖进 **应用程序（Applications）** 文件夹。
3. **首次打开需要一步操作**（因为本应用未做 Apple 付费公证）：
   - 打开「**终端**」(Terminal)，粘贴并回车：

     ```bash
     xattr -cr /Applications/Pawkeeper.app
     ```

   - 之后在「应用程序」里**双击 Pawkeeper** 即可正常打开，以后每次都直接双击。

> 为什么需要这一步？macOS 会拦截没有付费开发者签名/公证的应用。上面这条命令只是移除系统给下载文件加的「隔离」标记，是安全的一次性操作。

### English

1. Download `Pawkeeper-*-arm64.dmg` from **Assets** below.
2. Open the DMG and drag **Pawkeeper** into your **Applications** folder.
3. **First launch needs one step** (this build is not paid-notarized by Apple):
   - Open **Terminal**, paste and press Enter:

     ```bash
     xattr -cr /Applications/Pawkeeper.app
     ```

   - Then **double-click Pawkeeper** in Applications. After that it opens normally every time.

> Why? macOS blocks apps without a paid Developer signature/notarization. The command above simply removes the "quarantine" flag macOS adds to downloads. It is a safe, one-time step.
