# Changelog

本文件记录 mooncocoon-web（www.lunakoru.com 官网）的部署变更。

格式：`## [YYYY-MM-DD]`，最新条目在最上方。`/deploy-lunakoru` 部署时会检查当天是否有对应段落，并据此打 `lunakoru-deploy-YYYY-MM-DD` tag。

---

## [2026-05-25]

### 接入说明
- 接入 workspace 多项目管理（与 Aildo-JAVA、Aildo-Android 等同级 clone 到 workspace 根目录）
- 接入 `/deploy-lunakoru` 部署 skill：CloudBase CLI 上传到 TCB Hosting `cloud1-0gqgocyif5e12142`，部署后自动 curl 验证 etag 变化

### 现网功能（已上线基线）
- 桌面端：英雄区视频背景、自定义 cursor 动画、模块滚动动画、关于区域 value-item 滑入动效
- 移动端自适应：隐藏 cursor、紧凑布局、占满全屏、nav 不跟随滚动
- 视频轮播：左右箭头切换（叠化 + 外发光）、tab 切换滑动动效、单视频/缺失视频时隐藏控件
- 性能：所有子 tab 首个视频预加载、隐藏 video 元素预缓冲避免切换闪烁
- 视觉：Apple 风格字体、nav 渐变遮罩、视频区域整体下移 40px 对齐视觉重心
