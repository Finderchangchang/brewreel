# 用照片生成卡通讲解员

第一期是：看一张照片，自动挑一套 Open Peeps 部件，写成 `meta.presenter.look`。嘴、眨眼、换手势、镜像都还是现在这套，不另做动画。

## 能做到什么

从照片里判断这些，并且每一项都只能落在 react-peeps 的清单上：

- 性别预设：`male` 或 `female`。预设只提供一组默认值，写出来的发型、眼镜、胡子、衣服会盖过预设。
- 发型、眼镜（`accessory`）、胡子。
- 肤色：一个 `#RRGGBB`，写进 `look.skin`。识别和校验照旧。**肤色暂不生效**，画面保持 Open Peeps 的白色。
- 衣服族：`darkSweater`、`blackTee`、`whiteShirt` 里气质最接近的一套。换手势不会换出这一族。

模型如果返回了清单外的值，脚本会改成最接近的合法值，并在终端和 `look.log.txt` 里写明改了什么。`look.json` 可以直接放进讲稿：

```json
{
  "kind": "cartoon",
  "look": {
    "preset": "female",
    "hair": "Bun",
    "accessory": "GlassRound",
    "facialHair": "None",
    "outfit": "blackTee",
    "skin": "#E0B090"
  }
}
```

## 做不到什么

不是照片级相似。对得上的是发型、眼镜、胡子和衣服气质。脸型、五官、年龄、真实衣服款式都不会像本人。肤色会记下来，这一版不填到人物上。预览图和终端都会写上这句话。

Open Peeps 没有「这个人」的部件。光头、圆框眼镜、山羊胡这一类特征能对上；照片里的具体脸对不上。

## 照片授权

只用本人的照片，或者已经得到本人、客户授权的照片。没有授权不要跑。

照片会送到看图接口做识别。命令在真正发送之前打印一行：`照片会发送给 <域名> 做识别`。`--mock` 只回放本地 JSON，照片不会离开这台电脑。

照片和预览只写到 `--out` 所在目录，不进仓库，也不进缓存。密钥只从环境变量读，不写进 `look.json`、日志或预览。

## 怎么用

默认看图模型是 MiniMax-M3，和配音共用 `MINIMAX_API_KEY`。没设 `VISION_API_KEY` 时，地址是 `https://api.minimaxi.com/v1`。开放平台 OpenAI 兼容文档里的示例主机是 `https://api.minimax.cn/v1`，模型名 `MiniMax-M3` 在文档的模型列表里，并且支持 `image_url`（可以是 base64 data URL）。钥匙和配音若是 `api.minimaxi.com` 这一套，就用默认地址；对不上时再改地址。

```bash
node scripts/lesson/presenter-from-photo.mjs photo.jpg --out out/look.json
```

MiniMax 自家域名（`api.minimaxi.com`、`api.minimax.cn`、`api.minimax.io`）仍然只用 `MINIMAX_API_KEY`：

```bash
node scripts/lesson/presenter-from-photo.mjs photo.jpg --out out/look.json --base-url https://api.minimax.cn/v1 --model MiniMax-M3
```

别家看图模型要成对设置 `VISION_API_KEY` 和 `VISION_BASE_URL`。不会把 MiniMax 的 key 发到别的地址，也不会把 `VISION_API_KEY` 发到 MiniMax。只设了其中一个会直接报错。

地址必须是 https。只有本机代理可以用 `http://127.0.0.1` 或 `http://localhost`。请求有超时。

同一目录会多两个文件：`look.preview.png`（照片缩略图和三个姿势）和 `look.log.txt`。三个姿势按衣服族取三套不同的身体，脸朝左，和成片一样。

手改 `look.json` 之后，不调用模型，直接看效果：

```bash
node scripts/lesson/presenter-preview.mjs out/look.json --out out/preview.png
```

不合法的手改会按讲稿校验报中文错误，不会偷偷改掉。

测试不要打到在线模型，用本地回放：

```bash
node scripts/lesson/presenter-from-photo.mjs photo.png --out out/look.json --mock fixture.json
```

`fixture.json` 可以是模型会返回的那份 JSON，也可以是带 `choices[0].message.content` 的聊天响应。
