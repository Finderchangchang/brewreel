# 在自己的电脑上安装

这份说明给第一次使用的人。你不需要会编程，也不需要安装 Claude。写稿用 DeepSeek，配音用 MiniMax，出片在你自己的电脑上完成。

请先把安装包解压到一个你找得到的文件夹，例如「文档」里的 `brewreel`。后面说的「解压文件夹」就是它。命令都在这个文件夹里运行。

成片默认放在解压文件夹的**上一级**，名字是 `brewreel-studio-out`。角色档案默认放在上一级的 `brewreel-data`。这两个位置跟着你打开命令行时所在的文件夹走，不写死在某一台电脑上。

如果上一级还没有 `brewreel-data`、只有旧目录 `brewreel-studio-data`，程序仍会读旧目录。

## 你要准备的

- 电脑：Windows 10 或更高（64 位），或者 macOS 15 或更高。
- 网络：第一次安装要下载大约几百 MB，外加约 110 MB 的浏览器。
- Node.js：版本 18 或更高，建议装 20 LTS。
- 两个密钥，向提供方索取，只放在系统环境变量里，不要写进文件、聊天记录或安装包：
  - `DEEPSEEK_API_KEY`：写稿
  - `MINIMAX_API_KEY`：配音
- Python：可装可不装。不装也能出片，只是没有背景音乐。出片时会明确写「本片没有配乐」，配音还在，不会悄悄给你一条没声音的片子。

讲课引擎跟随精酿，使用 Apache-2.0。没有单独的许可文件，缺了也不会拒绝出片。

## Windows

1. 打开浏览器，访问 `https://nodejs.org`，下载 **20 LTS**，一直点下一步装完。装完关掉已经开着的命令行窗口。
2. 解压安装包。进入解压文件夹，在地址栏输入 `powershell` 后回车。窗口里的路径应该就是这个文件夹。
3. 安装出片程序。复制下面两行，粘贴到窗口里，回车，等它跑完。中途不要关窗口。

```powershell
cd template
npm ci
```

4. 回到解压文件夹：

```powershell
cd ..
```

5. 设置密钥。按 Windows 键，搜索「环境变量」，打开「编辑系统环境变量」，点「环境变量」。在**用户变量**里点「新建」：
   - 变量名 `DEEPSEEK_API_KEY`，变量值填你的 DeepSeek 密钥
   - 再新建一个，变量名 `MINIMAX_API_KEY`，变量值填你的 MiniMax 密钥

   确定关掉窗口。**关掉 PowerShell 再重新打开**，否则它看不到新变量。重新打开的方法和第 2 步一样。

6. 检查环境。在解压文件夹里运行：

```powershell
node scripts/lesson/doctor.mjs
```

   每一项前面是 `✓` 或 `✗`。`✗` 下面有中文修法，按它做完再跑一次。全部必需项通过时，最后一行是「结果：必需项都通过。」Python 那一项标了「可选项」，是 `✗` 也可以先出片。

7. 出第一支样片。这一支用占位配音，不花配音费，用来确认电脑能出片：

```powershell
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ..\brewreel-studio-out\first-lesson --voice-provider mock
```

   跑完后，成片在解压文件夹上一级的 `brewreel-studio-out\first-lesson\video.mp4`。同目录还有字幕、章节和一张检查拼图。

## macOS

1. 打开浏览器，访问 `https://nodejs.org`，下载 **20 LTS** 的 macOS 安装包，装完。
2. 打开「终端」。把解压文件夹拖进窗口，前面补上 `cd` 和一个空格，回车。例如文件夹在「文稿」里，命令类似 `cd ~/Documents/brewreel`（以你拖进去的路径为准）。
3. 安装出片程序：

```bash
cd template
npm ci
cd ..
```

4. 设置密钥。终端里运行（把引号里换成你的密钥，两行都要跑）：

```bash
echo 'export DEEPSEEK_API_KEY="这里换成你的密钥"' >> ~/.zshrc
echo 'export MINIMAX_API_KEY="这里换成你的密钥"' >> ~/.zshrc
source ~/.zshrc
```

   这两行写在你的个人配置里，不在安装文件夹里。不要把 `~/.zshrc` 发给别人。

5. 检查环境：

```bash
node scripts/lesson/doctor.mjs
```

   看每一项的 `✓` / `✗` 和下面的修法。最后一行是「结果：必需项都通过。」就可以继续。

6. 出第一支样片：

```bash
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-studio-out/first-lesson --voice-provider mock
```

   成片在解压文件夹上一级的 `brewreel-studio-out/first-lesson/video.mp4`。

## 想要背景音乐

背景音乐是程序现做的，不带版权素材。需要 Python 3.10 或更高，以及两个库。

Windows 可到 `https://www.python.org` 下载 Python 3.10 或更高。安装时勾选 **Add python.exe to PATH**。macOS 可安装 python.org 的安装包。

然后在解压文件夹里运行：

```bash
pip install -r requirements.txt
```

再跑一次 `node scripts/lesson/doctor.mjs`。Python 那一项变成 `✓` 后，正常出片就会带配乐。没装好时，片子仍然有配音，日志和交付清单里会写明「本片没有配乐」。

## 正式出片

样片确认电脑没问题之后，把选题写成一份 brief，再用下面的命令。`--voice-provider mock` 是占位音；正式配音把 mock 换成 `minimax`。

```bash
node scripts/lesson/studio.mjs --brief 你的brief.json --out ../brewreel-studio-out/片子名字 --voice-provider minimax
```

不写 `--out` 时，成片放在当前文件夹上一级的 `brewreel-studio-out`。普法内容会先停下来等律师审稿，技术讲解会直接出片。

密钥没设、或者 doctor 里有必需项是 `✗`，先不要正式出片。

DeepSeek 插件用仓库里现有的开源插件。讲课命令行本身不依赖那个插件。
