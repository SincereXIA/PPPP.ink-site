# PPPP.ink 网站框架

本仓库保存 VuePress 1、定制主题、组件、样式和构建部署流水线。正文、图片、附件及内容编辑配置保存在 [SincereXIA/PPPP.ink](https://github.com/SincereXIA/PPPP.ink)。不再加载 `Private.PPPP.ink`。

## 目录

```text
vuepress/              网站配置、主题、组件和站点资源
scripts/               正文组装、图片校验和构建入口
image-sources.json     框架图片的来源、引用及校验值
test/                  仓库组装和文章 Git 时间验证
.github/workflows/     构建与服务器发布
.content/              正文仓库的本地 checkout（忽略）
.build/content/        自动组装的 VuePress 输入（忽略）
public/                网站构建产物（忽略）
```

## 本地预览

使用 `.nvmrc` 指定的 Node.js 22：

```bash
git clone git@github.com:SincereXIA/PPPP.ink-site.git
cd PPPP.ink-site
git clone git@github.com:SincereXIA/PPPP.ink.git .content
npm ci
npm run dev
```

已有正文工作目录时无需再次克隆：

```bash
CONTENT_DIR=/绝对路径/PPPP.ink npm run dev
CONTENT_DIR=/绝对路径/PPPP.ink npm run check:images
CONTENT_DIR=/绝对路径/PPPP.ink npm run build
CONTENT_DIR=/绝对路径/PPPP.ink npm run check:images -- --dist
```

`CONTENT_DIR` 是包含 `content/` 和 `image-sources.json` 的正文仓库根目录。构建不会修改正文或框架源文件。正文中的 `/images/...` 引用保持不变；每次构建都会清理并重建 `.build/content/`。正文 Git 历史用于保留文章的最近更新时间；“编辑此页”继续指向正文仓库的 `main/content/`。

本地不设置 `VALINE_APP_KEY` 也可以构建。需要验证评论时通过环境变量提供，勿将凭据写入源码。`npm run dev` 会在启动时复制正文；正文修改后重启预览以重新组装。

## 双仓库自动发布

- 本仓库 `main` 更新：触发网站重新构建。
- 正文仓库 `main` 更新：正文仓库调用本仓库 `deploy.yml` 的 `workflow_dispatch`，通过 `content_sha` 记录触发此次构建的内容提交。
- 生产流水线串行执行，并在开始时拉取两个仓库的最新 `main`。快速连续提交时，GitHub 可能合并等待中的运行；最后开始的运行仍会获取最新正文和框架，不会因为通知延迟而回退到旧内容。
- PR 只构建，不发布。部署前再次校验两个 SHA，已经过时的构建会跳过发布；下一次排队运行将重新获取最新版本。每次运行的 Summary 和网站的 `/build-info.json` 记录实际使用的两个提交 SHA。

手动运行可以通过 `content_ref` 构建指定的内容分支或 SHA，用于合并前验证。只有实际构建的两个 SHA 都与各自最新 `main` 一致时，才会部署到生产。

通知 workflow 仅在正文仓库，构建与部署 workflow 仅在框架仓库，避免互相触发。

## GitHub 首次配置

1. 创建 `SincereXIA/PPPP.ink-site`，默认分支为 `main`，上传本仓库。当前正文仓库为公开仓库，所以 checkout 正文无需额外的私有仓库密钥。
2. 在**框架仓库**配置 Actions secrets：

   | Secret | 用途 |
   | --- | --- |
   | `VALINE_APP_KEY` | 原 `SECRET_JS` 中的 `valineAppKey` 值；新框架直接从环境变量读取 |
   | `DEPLY_HOST` | 现有部署服务器地址，沿用旧变量名 |
   | `DEPLY_USERNAME` | 现有部署用户名，沿用旧变量名 |
   | `SSH_PRIVATE_KEY` | 服务器发布私钥 |

3. 创建 fine-grained PAT，仅选择 `PPPP.ink-site` 仓库并授予 **Actions: Read and write**。在**正文仓库**中保存为 `SITE_WORKFLOW_TOKEN`。也可以用 GitHub App token 替代。默认 `GITHUB_TOKEN` 无法操作另一个仓库。
4. 在正文仓库启用新的 `.github/workflows/notify-site.yml`，替代原部署 workflow。若框架仓库改名，设置正文仓库变量 `SITE_REPOSITORY`。
5. 分别验证一次正文 `main` 更新、框架 `main` 更新，并核对远端 `/build-info.json` 和文章、图片。两个分支均准备好、secrets 配置好后再切换生产，避免旧部署与新部署同时运行。

GitHub 上已有的 Secret 无法读取明文，需要使用原始凭据重新配置。旧的 `SECRET_JS` 和 `PPPP_INK_PRIVATE_KEY` 不再被 workflow 使用；无需给新仓库配置私有内容访问权限。

本次拆分保留正文仓库的既有历史，不需要强制推送。框架初始提交来自原正文仓库的 `b7f9169`；VuePress 及依赖版本沿用原 lockfile。Node.js 22 构建时由入口脚本为 webpack 4 开启 OpenSSL legacy provider。
