# 资源来源与发布范围

- `watch/src/Common/icons/`：项目原创的几何线条图标，由 `scripts/create-vector-assets.py` 生成；可随项目代码的 MIT 许可使用。
- `examples/neutral-pet/`：项目原创几何示例角色，可随项目代码的 MIT 许可使用。不是任何真人的化身。
- `examples/neutral-atlas.png`：使用该示例角色排成的 8 × 11 图集。
- `watch/src/Common/scenes/room.png`：本项目通过内置 imagegen 生成的小屋背景，随后转换为手表分辨率。没有加入第三方品牌或人物；可替换为自己有权使用的场景图。
- 拼音表：使用 tiny-pinyin 1.3.2 和构建环境的中文排序数据生成。第三方 MIT 许可见 `TINY_PINYIN_LICENSE.txt`。
- 个人工程中的真人原型角色、私人称呼、旧截图、签名和服务数据不进入公开模板。公开素材的发布范围不包含用户以后上传的资源；上传者需自行决定是否分享自己的角色包。

MIT 是本地开源草案的默认建议，尚未替维护者发布到任何代码托管服务。

## 场景最终生成提示词

使用内置 imagegen，输出后只做尺寸与编码转换，项目资源为 `watch/src/Common/scenes/room.png`。

Use case: illustration-story. Asset type: background scene for a 432 x 514 pixel portrait smartwatch virtual companion app. Create an ORIGINAL clean cozy illustrated room interior, no characters, no animals, no text, no letters, no UI, no logos or watermarks. Soft hand-painted anime game background with clean simplified shapes and muted cel shading, warm cream walls, dusty teal accents and honey wood floor. Straight-on wall with gentle room depth, NOT isometric. Design for a large chibi character standing in the CENTRAL FOREGROUND: leave the entire middle vertical area from x=24% to 76%, y=26% to 85% visually quiet and unobstructed; a simple oval woven rug centered at x50%, y83% marks where the character's feet will stand. The floor begins around y68%. Add a small rounded window with pale blue sky in the UPPER LEFT area of the wall, a small plant at the FAR LEFT floor edge and low wooden shelving at the FAR RIGHT edge. The TOP 17% must remain plain low contrast wall for overlaid status icons, and the BOTTOM 14% must remain quiet floor for translucent touch controls. A welcoming intimate little room at late afternoon, warm natural light, subtle shadows, restrained detail, not too bright, readable at watch scale. Flat fills and soft texture rather than photorealism. Full bleed portrait canvas with approximately 432:514 aspect ratio; no rounded frame or device mockup.
