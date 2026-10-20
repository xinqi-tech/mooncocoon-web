# 月光茧官网 (mooncocoon-web)

## 相关链接

- **飞书设计方案文档**：https://feishu.cn/docx/AgdjdWXJloI1LJxRoZrc8SU7nwe
- **Figma 线框原型**：https://www.figma.com/design/iO27mrD2V65fuP6S2DGiLH
- **GitHub Pages 在线预览**：https://xinqi-tech.github.io/mooncocoon-web/
- **飞书设计方案文档**：https://feishu.cn/docx/AgdjdWXJloI1LJxRoZrc8SU7nwe
- **Figma 线框原型**：https://www.figma.com/design/iO27mrD2V65fuP6S2DGiLH
- **飞书原始需求文档**：https://pcni5ldjg9t4.feishu.cn/wiki/NXIZwPrCCihYQKkcYeecfPaTnig

## 目录结构

```
├── index.html          # 主页面
├── images/             # 图片素材
└── videos/             # 视频素材（按模块分类）
    ├── 01_persona_setup/
    ├── 02_appearance_customization/
    ├── 03_intimate_interaction/
    ├── 04_boyfriend_daily/
    ├── 05_dream_theater/
    └── 06_skill_system/
```


## 本地预约预览

运行 `python preview_server.py`，打开 http://127.0.0.1:8769/。连续点击首页标题 10 次显示预约面板。默认展示 PV 首屏。预览服务器只代理真实活动状态 GET 请求，避免 localhost 被线上 CORS 拒绝；不转发短信、登录或预约写请求。生产仍直连原 API。普通静态服务器无法提供这个本地代理。
