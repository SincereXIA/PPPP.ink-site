# PPPP.ink 网站框架

基于 [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) 的 Astro 7 静态博客。正文、图片和附件继续由 [SincereXIA/PPPP.ink](https://github.com/SincereXIA/PPPP.ink) 独立维护，两个仓库的 main 更新都会触发原有 GitHub Actions 和服务器发布。

保留 Retypeset 的左右布局、字体、配色、深色模式、视图过渡、文章排版、目录、图片放大、代码复制与 RSS。首页只在原生文章列表最左侧增加缩略图，有图的文章图文并排，无图文章正常显示文字。手机使用较小的缩略图和主题原有的顶部布局。

## 本地运行

使用 `.nvmrc` 指定的 Node.js 24 LTS：

```bash
npm ci
git clone git@github.com:SincereXIA/PPPP.ink.git .content
npm run dev
```

也可使用已有内容仓库：

```bash
CONTENT_DIR=/绝对路径/PPPP.ink npm run dev
CONTENT_DIR=/绝对路径/PPPP.ink npm run build
CONTENT_DIR=/绝对路径/PPPP.ink npm run check:images -- --dist
npm run preview
```

`npm run build` 自动完成内容组装、Astro/TypeScript 检查、静态构建、旧路径落盘、Pagefind 中文全文搜索索引和站点完整性校验。开发服务器不生成搜索索引；验证搜索请先 build，再 preview。内容变更后重启 dev 重新组装。所有生成文件都写入忽略的 `.build/`、`.astro/` 和 `public/`，不会修改任何源文章。

## 内容接入

- `content/about.md` 维护关于页正文。
- `content/blogs/` 的公开文章显示在首页和归档；`content/docs/` 的文档显示在文档页，并参与全文搜索和订阅。
- 兼容现有 `title`、`date`、`lastmod`、`tags`、`categories`；更新时间优先从内容仓库 Git 历史取得。
- `publish: false`、`draft: true` 和带有非空 `keys` 的文章在组装时排除，开发预览也不加载。它们不会进入网页、搜索、订阅和 OG 图片；源文件与已存在的图片仍留在内容仓库。
- 缩略图默认使用正文第一张本地图片。可在内容 frontmatter 中设置 `cover: /images/文件名` 指定图片，或 `cover: false` 关闭。也支持相对于文章的附件路径。
- 图片继续使用 `/images/...`；相对附件保留原公开地址；构建验证图片原始 SHA-256。
- 旧文章通过 `legacy-routes.json` 固定原来的 `.html` 或目录 URL。新文章可设置绝对站内 `permalink`，否则沿用内容目录及文件名。`slug` 不覆盖旧地址。
- 旧 `/tag/` 链接跳转到 Retypeset `/tags/`；分类、归档、文档入口保留。主动删除旧内容时同步更新 `legacy-pages.json` 中的预期路径，避免发布无意的链接丢失。
- 算法与操作系统文档保留 KaTeX、代码高亮以及原有 `==高亮==`、上下标写法。

Valine 升至 1.5.3，继续使用原 LeanCloud 应用、文章 URL 与历史评论。构建通过 `VALINE_APP_KEY` 环境变量启用评论。本地未设置时仍可完整构建；不要把凭据写入文件。该客户端应用标识的使用方式与旧站一致，不使用管理密钥。

## 部署与验证

框架 main 推送或内容仓库通知会触发 `.github/workflows/deploy.yml`。生产流水线串行执行，每次开始获取两个最新 main，发布前再次比较 SHA，过时构建跳过发布。PR 构建和指定内容分支预览不发布到生产。产物继续部署到原服务器 `/home/wwwroot/pppp.ink/public/`，并通过 HTTPS `/build-info.json` 确认实际生效版本。

框架 secrets：`VALINE_APP_KEY`、`DEPLY_HOST`、`DEPLY_USERNAME`、`SSH_PRIVATE_KEY`。内容仓库保留 `SITE_WORKFLOW_TOKEN`，fine-grained PAT 仅需框架仓库的 Actions: Read and write。无需 Private.PPPP.ink。

```bash
npm test
CONTENT_DIR=/绝对路径/PPPP.ink npm run check:images
CONTENT_DIR=/绝对路径/PPPP.ink npm run build
CONTENT_DIR=/绝对路径/PPPP.ink npm run check:images -- --dist
```

站点检查覆盖旧路径、文章标题与 canonical、OG 图片、隐藏文章和所有页面的本地链接/资源。上线另检查实际 HTTPS、搜索、深色模式及手机布局。

## 主题来源与升级

Retypeset 上游基线：`radishzzz/astro-theme-retypeset@a636b6d393be714cab52d3fc4baddd3f3905f701`（2026-10-31 导入）。MIT 许可见 `LICENSE`。`src/` 和 `static/` 中保留原主题组件与资源；站点定制见 `docs/retypeset-changes.md`。升级主题时对照此基线合并；内容继续在独立仓库写作。

Astro 7 使用官方支持的 Unified Markdown 管线，以保持 Retypeset 的 remark/rehype 插件。UnoCSS 与官方 MDX 集成更新到支持 Astro 7 / Vite 8 的版本。原 `astro-og-canvas` 未声明支持 Astro 7，因此只替换分享图片的构建实现，使用本地字体生成 PNG，不依赖上游演示截图服务。VuePress、Vue 2、webpack 4 及 OpenSSL legacy provider 已移除。

Valine/LeanCloud 的旧生态仍有传递依赖审计告警；本次保留历史评论兼容性，不将整个依赖树视为零漏洞。构建链使用的依赖与浏览器运行代码应分别评估，升级前不要直接使用 `npm audit fix --force`。
