# cards 主题清单

当前共 **18 套**：6 套基础主题、[10 套精选搭配](STUDIO_PALETTES.md)、2 套柔和鲜活主题。默认保持 `warm-emotion`。设置 `meta.theme` 选择主题。

## 六套基础主题

| 名称 | meta.theme | 图表系列色 |
| --- | --- | --- |
| 情绪渐变 | `warm-emotion` | Micro 默认色板 |
| 雾蓝 · 暗色 | `tech-dark` | `#9BAFCA` / `#A7B8EF` / `#6E8DA7` / `#C0CDD6` / `#7583AC` |
| 浅绿 · 纸白 | `fresh-light` | `#45645B` / `#286458` / `#849B7A` / `#BB866D` / `#A5AD92` |
| 浅蓝 · 商务 | `business-blue` | `#243D60` / `#315F9B` / `#7297BD` / `#A5B6C8` / `#577086` |
| 酒红 · 奶油 | `festival-red` | `#674245` / `#9B3E49` / `#BE9A60` / `#B77B79` / `#867364` |
| 石墨 · 香槟 | `mono-premium` | `#E4DDD0` / `#CEAF7B` / `#91A497` / `#A0A5AF` / `#8A7968` |

## 十套精选搭配

| 名称 | meta.theme | 图表系列色 |
| --- | --- | --- |
| 奶油 · 蓝橙 | `studio-cream-blue` | `#202832` / `#1555BC` / `#F06B35` / `#BFAE88` |
| 黑底 · 荧光绿粉 | `studio-neon` | `#A8B9B2` / `#D0F646` / `#ED62C7` / `#4E7371` |
| 浅粉 · 墨绿 | `studio-pink-green` | `#AEC9AD` / `#F4C2D2` / `#F3DF87` / `#79A597` |
| 钴蓝 · 奶油橙 | `studio-blue-orange` | `#1D438E` / `#DF6729` / `#D7B861` / `#95A5C4` |
| 白灰 · 红黑 | `studio-red-black` | `#20272E` / `#DC3443` / `#949DA3` / `#BBC1C4` |
| 深紫 · 淡黄 | `studio-purple-yellow` | `#4A2B66` / `#8751AD` / `#AF873B` / `#B899B7` |
| 湖蓝 · 黑白 | `studio-cyan` | `#243740` / `#11A5C3` / `#8AD2DF` / `#E6A347` |
| 青柠 · 葡萄紫 | `studio-lime-purple` | `#AAA62E` / `#7D47B7` / `#353041` / `#C99AD8` |
| 靛蓝 · 珊瑚 | `studio-indigo` | `#24345C` / `#465DC4` / `#EE7C68` / `#97A5D8` |
| 石墨 · 电橘 | `studio-graphite` | `#CBD7E5` / `#FF9B59` / `#91A6BC` / `#6F8BA9` |

## 两套柔和鲜活主题

| 名称 | meta.theme | 图表系列色 |
| --- | --- | --- |
| 珊瑚桃红 | `coral-pop` | `#8C74D6` / `#E45479` / `#F2B24C` / `#42A7A7` / `#D39AB2` |
| 鲜薄荷 | `mint-pop` | `#46A99B` / `#1C957D` / `#A5CE61` / `#F28B61` / `#7BAFE2` |

所有主题保留情绪渐变、品牌强调色覆盖和状态语义色。dataChart 不写 `params.palette` 时使用主题系列色，显式填写时采用指定色板。

## 本轮精简

移除上一轮 01–12 和鲜活主题中相近的黄、蓝、紫、杏橙版本，保留 13–16 的原 ID。删除的 ID 不再可选；旧分镜需要改用下表中的现有主题，避免回退到默认主题。

| 移除 ID | 推荐替代 |
| --- | --- |
| `citrus-pop` | `studio-lime-purple` |
| `cobalt-pop` | `studio-blue-orange` |
| `lilac-pop` | `studio-purple-yellow` |
| `apricot-pop` | `studio-cream-blue` |
| `studio-blue` | `studio-blue-orange` |
| `studio-pink` | `studio-pink-green` |
| `studio-green` | `mint-pop` |
| `studio-magenta` | `studio-purple-yellow` |
| `studio-lemon` | `studio-lime-purple` |
| `studio-mint` | `mint-pop` |
| `studio-orange` | `studio-cream-blue` |
| `studio-red` | `studio-red-black` |
| `studio-teal` | `studio-cyan` |
| `studio-violet` | `studio-purple-yellow` |
| `studio-lavender` | `studio-purple-yellow` |
| `studio-apricot` | `studio-cream-blue` |

```json
{"meta":{"theme":"studio-pink-green"}}
```
