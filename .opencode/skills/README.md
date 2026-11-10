# 已安装的游戏开发 Skills

安装日期：2026-11-09 ｜ 方式：直接从 GitHub 源仓库下载（本机无 Node，无法用 `npx skills`），复制到 `.opencode/skills/` 供 OpenCode 项目级自动发现。

| Skill ID | 用途 | 来源仓库 | 版本/提交 | 许可证 |
|---|---|---|---|---|
| `higgsfield-game-generation` | 游戏素材/音频生成（贴图、精灵表、3D 动画、音乐音效） | higgsfield-ai/skills | commit `9db2e5b`（删除前最后独立版本，见下方备注） | MIT |
| `game-developer` | 通用游戏开发（Unity/Unreal、ECS、物理、多人网络、优化） | jeffallan/claude-skills | main | 见仓库 |
| `game-ui-design` | 游戏 UI 设计（HUD、血条、菜单、diegetic 界面、跨平台） | omer-metin/skills-for-antigravity | main | Apache-2.0 |
| `game-design-theory` | 游戏设计理论（MDA 框架、玩家心理、心流、奖励系统） | pluginagentmarketplace/custom-plugin-game-developer | main | 见仓库 |
| `game-feel` | 操作手感/打击感（屏震、顿帧、缓动、挤压拉伸、反馈分层） | gamedev-skills/awesome-gamedev-agent-skills | main | Apache-2.0 |
| `game-ui-ux` | 游戏 UI/UX 工程模式（锚点布局、响应式、焦点导航、状态栈） | gamedev-skills/awesome-gamedev-agent-skills | main | Apache-2.0 |
| `threejs-game-ui-designer` | Three.js 游戏 UI（HUD、菜单、触屏、安全区、文字适配） | majidmanzarpour/threejs-game-skills | main | 见仓库 |
| `develop-web-game` | 网页小游戏开发-测试循环（小步实现 + Playwright 截图验证 + 控制台检查） | openai/skills | commit `82d2c5b4`（该 skill 已从 main 移除，取历史版本） | 见仓库内 LICENSE.txt |

## 备注

1. **higgsfield-game-generation**：上游 2026-08-07 提交 `383c14a` 已把它**合并进 `higgsfield-websites`**（`higgsfield website create --type game`）。本目录安装的是合并前最后一个独立版本（`9db2e5b`），即 skills.sh 上 26.6K 安装对应的快照。若以后想要新版整合流程，可改装 `higgsfield-websites`。该 skill 的实际生成能力需要 Higgsfield CLI + 账号（`higgsfield auth login`）。
2. **develop-web-game**：为 Codex 设计（skill 内路径按 `~/.codex/skills` 写）；其 Playwright 测试脚本需要 Node。本机无 Node，但工作流方法论（小步实现→操作→暂停→观察→调整）与 `render_game_to_text` 约定对任何 agent 都适用，可作为开发网页游戏的流程规范使用。
3. **game-developer**：面向 Unity/Unreal 等引擎，对当前 H5 项目参考价值有限，按需取用。
4. 与本项目（贴贴收纳夹）最相关：`game-feel`（M5 动效/反馈）、`game-ui-ux` + `game-ui-design`（HUD/菜单打磨）、`game-design-theory`（防无聊调研的落地验证）。
