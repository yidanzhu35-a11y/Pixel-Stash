$ErrorActionPreference = 'Stop'
$target = 'C:\Users\yidan.zhu\Desktop\personal\项目文件.MD'
$backup = 'C:\Users\yidan.zhu\Desktop\personal\work\项目文件.before-workflow.MD'
$encoding = [System.Text.UTF8Encoding]::new($false, $true)
$originalBytes = [System.IO.File]::ReadAllBytes($target)
$original = $encoding.GetString($originalBytes)
$script:content = $original
$script:changes = [System.Collections.Generic.List[object]]::new()
$newline = if ($original.Contains("`r`n")) { "`r`n" } else { "`n" }
function Replace-Once([string]$old, [string]$new, [string]$label) {
    $old = $old.Replace("`r`n", "`n").Replace("`n", $newline)
    $new = $new.Replace("`r`n", "`n").Replace("`n", $newline)
    $first = $script:content.IndexOf($old, [System.StringComparison]::Ordinal)
    if ($first -lt 0 -or $script:content.IndexOf($old, $first + $old.Length, [System.StringComparison]::Ordinal) -ge 0) {
        throw "Expected one exact match: $label"
    }
    $script:content = $script:content.Remove($first, $old.Length).Insert($first, $new)
    $script:changes.Add([pscustomobject]@{ Old = $old; New = $new; Label = $label })
}
function Replace-Section([string]$start, [string]$end, [string]$replacement, [string]$label) {
    $first = $script:content.IndexOf($start, [System.StringComparison]::Ordinal)
    $last = $script:content.IndexOf($end, $first + $start.Length, [System.StringComparison]::Ordinal)
    if ($first -lt 0 -or $last -lt 0) { throw "Missing section: $label" }
    Replace-Once $script:content.Substring($first, $last - $first) ($replacement.TrimEnd() + $newline + $newline) $label
}

Replace-Once @'
- 是否拥有旋转能力。

**重要：美术图片和逻辑占位形状必须分离。**
'@ @'
- 是否拥有旋转能力。

需要区分三层数据：
- 形状库：用 `shapeId` 标识可复用的 Shape Mask。
- 主题贴纸库：用 `stickerId` 标识一种贴纸，记录主题、美术素材和 `shapeId`。不同贴纸可以共用一种形状，但物件轮廓必须与占位形状相符。
- 关卡贴纸实例：本关实际需要摆放的每一张贴纸。每个实例有本关内唯一的 `id`，通过 `stickerId` 引用主题贴纸，并分别记录位置、初始方向、当前旋转角度和旋转能力。

每关只选用所属主题库中的一部分贴纸，不要求该主题的所有贴纸都在每一关出现。同一种贴纸可以在同一关重复出现多次，例如 3 张完全相同的咖啡贴纸；它们共用同一份美术和形状，但分别移动、判定和完成放置。旋转名额按实例计算，给其中一张解锁旋转，不会同时解锁另外两张。

**重要：美术图片和逻辑占位形状必须分离。**
'@ '2.2 形状、素材与实例的区分'

Replace-Once '统计时应排除相同形状贴纸交换顺序造成的重复解；包含贴纸旋转、叠放造成的不同解。不能仅凭解法数量判断关卡难度。' '统计时应排除可互换贴纸实例交换身份造成的重复解，例如 3 张相同咖啡贴纸仅交换实例 ID，不应计为新解。可互换性需要同时考虑形状、初始方向、旋转和叠贴等规则，不能只看图片或形状相同；包含贴纸旋转、叠放造成的不同解。不能仅凭解法数量判断关卡难度。' '6.1 重复实例的解法计数'

Replace-Section '## 7.1 生成方式' '## 7.2 求解器（Solver）' @'
## 7.1 生成方式

采用 AI 分步实现生成工具与求解器 + 程序生成候选关卡 + 用户试玩反馈。AI 负责提出设计、编写代码、生成配置和执行验证，不能仅凭文字判断关卡可解或有趣。

关卡从经过小规模验证的主题贴纸库中取件，具体建库流程见第 8.2 节。推荐使用受素材库约束的反向生成：

1. 根据本关目标难度和允许的机制，从所属主题库选择若干种贴纸，并确定每种的数量；可以只用库中的一部分，也可以重复选用同一种。
2. 为每张实际使用的贴纸创建独立实例 ID，引用已有 `stickerId`，不为每关重新创建形状或美术。
3. 使用这些实例，在本关真实的留白、障碍、初始方向、旋转名额及特殊机制限制下，搜索一个完整可行布局。
4. 保存关卡配置和至少一份参考解，再将贴纸放回待收纳区域、打乱顺序。参考解用于验证，不限制玩家采用其他正确摆法。
5. 使用求解器验证，筛选候选关卡并结合试玩调整。只要改变画布、障碍、贴纸组合、初始方向或旋转规则，就要重新验证。

不得通过任意切割完整布局来不断产生新的 Shape Mask。已有素材不足时，先调整选件、数量、画布或障碍；确实需要新形状时，按第 8.2 节回到主题库调整流程，而不是悄悄新增一张仅服务当前关卡的素材。

从真实规则下的完整布局生成，可以提供至少一份可行解；后续调整仍可能破坏可解性。如果需要增加镂空、障碍和特殊叠贴，生成器必须使用对应的真实规则进行验证，不能只检查贴纸面积。
'@ '7.1 从有限主题库生成关卡'

Replace-Once @'
- 所有特殊规则均得到正确验证。
- 难度符合所在阶段的预期。
'@ @'
- 所有特殊规则均得到正确验证。
- 难度符合所在阶段的预期。
- 所有贴纸引用均有效，实例 ID 不重复；重复使用同一种贴纸时，各实例均被独立计入求解和通关判定。
'@ '7.3 素材引用与实例验证'

Replace-Once '- 20–30 张独立贴纸。' '- 20–30 种独立贴纸素材。这是主题库的素材种类预算，不是每关贴纸数量，也不是 Shape Mask 数量。' '8.1 素材预算口径'

Replace-Once '所有主题的 UI 图标和反馈素材全部用相同的一套。' @'
所有主题的 UI 图标和反馈素材全部用相同的一套。

复用与数量控制：
- 每关从所属主题库选择贴纸种类及各自数量，不必用完主题库。同款贴纸可跨关复用，也可在同一关出现多张；重复实例不增加素材种类。
- Shape Mask 数量单独控制，不要求每种美术都有独有形状。通用形状可以跨主题复用，同时为主题特色物件保留少量独特形状。
- 每个主题先用少量候选形状和物件草图试做，再根据结果记录形状数量上限和贴纸素材清单；不得把 20–30 种美术素材直接等同于 20–30 种形状。
- 主题物件与形状共同设计，例如杯把可以启发侧面凸出的形状；不能先随意造形状，再硬套成不自然的物件。
- 素材库确定后，关卡默认只引用已有素材。需要新增或修改形状时，记录原因、预计使用的关卡和预算变化，并重新验证受影响的关卡。
'@ '8.1 复用规则与形状预算'

Replace-Section '## 8.2 AI 素材生成流程' '---' @'
## 8.2 AI 素材生成流程

按主题分批推进：先做春季主题的小规模验证，再扩展到该主题的完整关卡；其他主题重复这一流程。无需先完成全部 50 关，也不要一开始批量生成全部正式美术。

1. **建立候选目录。** AI 根据主题物件、对应关卡范围和第 6.2 节的机制安排，提出少量候选贴纸及 Shape Mask，记录 `stickerId`、物件名称、`shapeId` 和简单草图或占位图。物件和形状一起调整，先验证最小集合，不必立即凑满 20–30 种素材。
2. **制作可玩样本。** AI 用候选库制作少量代表关卡，覆盖该主题所需的难度和机制；只允许选用该主题当前阶段可以使用的机制。用占位图即可验证逻辑，同时挑几张贴纸制作接近最终效果的美术样本，检查手机尺寸下的轮廓、白边和留白是否清晰。
3. **验证并调整。** AI 运行求解器和实例校验，交付可玩版本，由用户试玩反馈。根据结果调整物件、形状、选件和画布；有解不等于有趣，也不等于最终画面好看。
4. **固定本批素材清单。** 样本通过后，记录该主题的形状上限、形状定义、贴纸目录和图片规格。扩展完整主题库时仍遵守预算。后续修改记录影响范围，保持关卡引用有效，不随关卡数量增长不断新增素材。
5. **分批扩展关卡和正式美术。** 在形状稳定后，两项工作可以交替或并行推进。关卡引用目录；AI 按目录生成统一风格的像素贴纸，逐张生成或从素材图中提取，去除背景并保存透明 PNG，统一像素尺寸、色板和白色描边，再与对应 Shape Mask 绑定。不需要等所有关卡布局确定后才生成正式图片，也不为重复实例重复生成图片。
6. **回到游戏验收。** AI 检查素材引用、显示尺寸、旋转对齐和逻辑占位，重新验证受影响关卡，提供可玩版本供用户确认体验；通过后再扩大制作范围。

美术图片可以超出逻辑占位格子的边缘，但必须保证视觉边界不会造成玩家对碰撞规则的误解。若图片难以匹配既定形状，优先修改图片；确需修改 Shape Mask 时，必须同步检查所有引用它的关卡。
'@ '8.2 适合 AI 小步执行的生产流程'

Replace-Section '## 9.1 核心数据结构' '## 9.2 逻辑模块' @'
## 9.1 核心数据结构

形状库、主题贴纸库与关卡配置分开维护。建议每关使用独立 JSON 配置，通过 ID 引用共享目录，避免各关复制并修改同一张贴纸的形状和素材。

以下 JSON 将三层数据放在一起展示关系；实际文件可以分别保存。示例中，本关只选用了春季库的两种贴纸，其中同一款咖啡出现 3 次：

```json
{
  "shapes": {
    "cup_compact": [[0,0],[1,0],[2,0],[0,1],[1,1]],
    "flower_l": [[0,0],[1,0],[0,1]]
  },
  "stickerCatalog": {
    "spring_coffee_01": {
      "themeId": "spring",
      "asset": "stickers/spring/coffee_01.png",
      "shapeId": "cup_compact"
    },
    "spring_flower_01": {
      "themeId": "spring",
      "asset": "stickers/spring/flower_01.png",
      "shapeId": "flower_l"
    }
  },
  "level": {
    "levelId": 1,
    "themeId": "spring",
    "board": {
      "width": 7,
      "height": 7,
      "blockedCells": []
    },
    "rotationTokens": 0,
    "pieces": [
      { "id": "coffee_01", "stickerId": "spring_coffee_01", "initialRotation": 0, "rotationEnabled": false },
      { "id": "coffee_02", "stickerId": "spring_coffee_01", "initialRotation": 0, "rotationEnabled": false },
      { "id": "coffee_03", "stickerId": "spring_coffee_01", "initialRotation": 0, "rotationEnabled": false },
      { "id": "flower_01", "stickerId": "spring_flower_01", "initialRotation": 0, "rotationEnabled": false }
    ],
    "stackRules": [],
    "goal": "place_all_pieces"
  }
}
```

`initialRotation` 是本关初始方向；位置、当前角度和旋转能力等运行状态按实例保存，不写回共享贴纸定义。叠贴兼容性可以由贴纸种类定义，但实际叠贴关系必须记录参与实例的 ID，不能因贴纸同款而同时移动或叠放所有副本。

正式数据结构需要进一步支持：
- 镂空形状。
- 特殊叠贴组合。
- 特殊相对位置。
- 关卡难度元数据。
- 解法统计信息。
'@ '9.1 共享目录及同款三实例示例'

Replace-Once '建议分为五个里程碑。' @'
建议分为五个里程碑。整个游戏采用 AI 分步开发（vibe coding），本文描述完整目标，不要求 AI 在一次任务中实现所有功能、关卡和美术。

每次交给 AI 的任务应说明：当前阶段、需要读取的现有文件、本次修改范围、交付物和验证方式。AI 先读取现有实现及最新素材目录，再完成一个可运行、可检查的小步骤；保留用户已有修改，不因推进下一阶段而重写无关内容。

每步完成后，AI 记录已完成内容、实际验证结果、未解决问题和下一步；验证通过后再扩展依赖它的功能。关键体验节点交付可玩版本供用户反馈。逻辑原型可以使用占位图，但需尽早检查少量正式美术样本。不得仅用文字声称已实现、已可解或已完成素材生产。

下列里程碑表示主要依赖顺序。主题候选库和小规模美术验证从 M1 开始，正式素材在 M4 按主题逐批接入，M5 负责最终打磨与发布。
'@ '10 AI 分步开发约定'

Replace-Once @'
## M1：完善核心原型

- 重新设计前三关，增加格子数量和贴纸数量。
'@ @'
## M1：完善核心原型

- 先建立少量春季候选贴纸、共享形状和实例引用，支持同一关使用多张同款贴纸；用占位图和少量美术样本验证。
- 重新设计前三关，增加格子数量和贴纸数量。
'@ 'M1 提前验证小型主题库'

Replace-Once @'
- 验证多解情况下的提示逻辑。

交付：具有完整提示能力的核心游戏。
'@ @'
- 验证多解情况下的提示逻辑。
- 用同关 3 张相同咖啡贴纸的案例，验证独立移动、旋转名额、提示、重置和通关判定；验证可互换实例不会虚增解法数量。

交付：具有完整提示能力的核心游戏。
'@ 'M2 重复实例验证'

Replace-Once @'
## M4：50 关内容制作

- 建立关卡配置系统。
- 批量生成候选关卡。
- 使用 Solver 验证。
- 调整解法数量和难度。
- 人工试玩和修改。

交付：50 关完整关卡数据。
'@ @'
## M4：50 关内容制作

- 完善关卡配置系统，维护形状库、主题贴纸库和关卡实例的引用关系。
- 按主题执行第 8.2 节：候选目录、少量样本关卡、程序验证与用户试玩、固定素材清单，再分批扩展。先完成并验证春季主题，再依次推进其他主题。
- 从有限素材库批量生成候选关卡，用不同贴纸子集、同款数量、画布、障碍和该阶段允许的机制形成变化，不靠不断新增形状扩充关卡。
- 使用 Solver 验证，调整解法数量和难度，人工试玩和修改。
- 形状稳定后分批制作并接入正式美术，不把全部素材生产推迟到 50 关完成之后。
- 记录每种贴纸在哪些关卡使用及各关数量，便于检查复用与修改影响；不要求每种贴纸在每关出现，也不强制使用次数相同。

交付：50 关完整关卡数据、对应的有限主题素材库及验证记录。
'@ 'M4 按主题迭代内容与美术'

Replace-Once '- 完成像素贴纸素材库。' '- 补齐并打磨 M4 已分批接入的像素贴纸素材，检查全部主题的风格、轮廓与占位一致性。' 'M5 最终美术打磨'

# Prove that the edited text can be reversed exactly, preserving all unrelated text.
$reversed = $script:content
for ($i = $script:changes.Count - 1; $i -ge 0; $i--) {
    $change = $script:changes[$i]
    $first = $reversed.IndexOf($change.New, [System.StringComparison]::Ordinal)
    if ($first -lt 0 -or $reversed.IndexOf($change.New, $first + $change.New.Length, [System.StringComparison]::Ordinal) -ge 0) {
        throw "Reverse validation failed: $($change.Label)"
    }
    $reversed = $reversed.Remove($first, $change.New.Length).Insert($first, $change.Old)
}
if (-not [string]::Equals($reversed, $original, [System.StringComparison]::Ordinal)) { throw 'Unrelated text changed' }
if ([Convert]::ToBase64String([System.IO.File]::ReadAllBytes($target)) -ne [Convert]::ToBase64String($originalBytes)) { throw 'Source changed during editing' }
if (Test-Path -LiteralPath $backup) { throw 'Backup already exists; refusing to replace it' }
[System.IO.File]::WriteAllBytes($backup, $originalBytes)
[System.IO.File]::WriteAllBytes($target, $encoding.GetBytes($script:content))
$readback = $encoding.GetString([System.IO.File]::ReadAllBytes($target))
if (-not [string]::Equals($readback, $script:content, [System.StringComparison]::Ordinal)) { throw 'Readback mismatch' }
$jsonMatch = [regex]::Match($readback, '(?s)```json\r?\n(.*?)\r?\n```')
$example = $jsonMatch.Groups[1].Value | ConvertFrom-Json
$coffee = @($example.level.pieces | Where-Object stickerId -eq 'spring_coffee_01')
if ($coffee.Count -ne 3 -or @($example.level.pieces.id | Sort-Object -Unique).Count -ne 4) { throw 'Invalid repeat-instance example' }
foreach ($piece in $example.level.pieces) {
    $sticker = $example.stickerCatalog.($piece.stickerId)
    if (-not $sticker -or -not $example.shapes.($sticker.shapeId)) { throw 'Invalid catalog reference' }
}
$script:changes | ForEach-Object { Write-Output $_.Label }
Write-Output 'PASS: exact reversal proves all text outside the listed edits is preserved; encoding and line endings retained.'
Write-Output 'PASS: file readback and JSON references; three coffee instances share one sticker definition and have unique IDs.'
