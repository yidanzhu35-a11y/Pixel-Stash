// ============================================================
// main.js（启动与页面装配）
// - 关卡加载 / 切换 / 重置
// - 进度本地保存（localStorage）
// - 顶部 HUD、旋转能力面板、通关结算、提示气泡
// ============================================================
(function () {
  var STORAGE_KEY = "pixelStash.progress.v1";
  var mainLevels = LEVELS.filter(function (l) { return !l.isTest; });
  var testLevel = LEVELS.find(function (l) { return l.isTest; });

  // ---------- DOM ----------
  var canvas = document.getElementById("game");
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");
  var levelLabel = document.getElementById("levelLabel");
  var resetBtn = document.getElementById("resetBtn");
  var hintBtn = document.getElementById("hintBtn");
  var tokenBadge = document.getElementById("tokenBadge");
  var actionPanel = document.getElementById("actionPanel");
  var unlockBtn = document.getElementById("unlockBtn");
  var rotateBtn = document.getElementById("rotateBtn");
  var deselectBtn = document.getElementById("deselectBtn");
  var winOverlay = document.getElementById("winOverlay");
  var winTitle = document.getElementById("winTitle");
  var winSub = document.getElementById("winSub");
  var winNextBtn = document.getElementById("winNextBtn");
  var winReplayBtn = document.getElementById("winReplayBtn");
  var winCloseBtn = document.getElementById("winCloseBtn");
  var toast = document.getElementById("toast");
  var testLink = document.getElementById("testLink");

  var renderer = new Renderer(canvas);
  var game = null;
  var input = null;
  var currentIdx = 0; // mainLevels 下标
  var isTestMode = false;

  // ---------- 进度 ----------
  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveProgress() {
    if (!game || isTestMode) return;
    var p = loadProgress();
    p.unlocked = Math.min(
      mainLevels.length,
      Math.max(p.unlocked || 1, game.win ? currentIdx + 2 : currentIdx + 1)
    );
    p.current = currentIdx;
    if (game.win) p.completed = Object.assign({}, p.completed, (function () { var o = {}; o[game.level.levelId] = true; return o; })());
    p.layouts = p.layouts || {};
    p.layouts[game.level.levelId] = game.serialize();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
  }

  // ---------- 关卡加载 ----------
  function loadLevel(idx, opts) {
    var p = loadProgress();
    var level = mainLevels[idx];
    isTestMode = false;
    currentIdx = idx;
    setupGame(level);

    var layout = p.layouts && p.layouts[level.levelId];
    var completed = p.completed && p.completed[level.levelId];
    if (layout && !completed && !(opts && opts.fresh)) {
      game.restoreLayout(layout);
    }
    updateHUD();
    renderer.render();
  }

  function loadTestLevel() {
    isTestMode = true;
    setupGame(testLevel);
    updateHUD();
    renderer.render();
  }

  function setupGame(level) {
    if (input) input.setGame(null);
    game = new Game(level);
    renderer.setGame(game);
    if (!input) {
      input = new InputController(canvas, renderer, game, {
        onSelectionChange: function () { updateHUD(); },
        onInvalidDrop: function (piece, res) {
          showToast(reasonText(res));
        },
      });
    } else {
      input.setGame(game);
    }
    game.onChange(function () {
      renderer.render();
      updateHUD();
      saveProgress();
    });
    game.onWin(function () {
      saveProgress();
      showWin();
    });
    winOverlay.classList.add("hidden");
    renderer.clearHint(); // 换关时清掉残留的提示闪烁
    hintSeen = [];
    hintSig = null; // 去重记录随换关作废
  }

  // res 可以是字符串（旧调用）或 checkCells 的完整结果；
  // 有 occupant 时点名挡路贴纸，帮玩家理解"为什么放不下"。
  function reasonText(res) {
    var reason = typeof res === "string" ? res : res && res.reason;
    var blockerName = null;
    if (res && typeof res === "object" && res.occupant != null && game && game.pieces) {
      var bp = game.pieces[res.occupant];
      if (bp && bp.sticker) blockerName = bp.sticker.name;
    }
    switch (reason) {
      case "overlap": return blockerName ? "叠到「" + blockerName + "」上啦" : "叠到别的贴纸上了~";
      case "gap": return blockerName ? "和「" + blockerName + "」挨太近啦，中间要留一格空隙" : "贴纸之间要留一个空格哟";
      case "out_of_bounds": return "超出纸页范围啦（贴纸会露出纸页外）";
      case "blocked": return "这里被占住了，不能贴";
      default: return "这个位置放不下";
    }
  }

  // ---------- HUD ----------
  function updateHUD() {
    var level = game.level;
    if (isTestMode) {
      levelLabel.textContent = "🧪 旋转测试关（沙盒）";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    } else {
      var progress = loadProgress();
      var unlockedCount = progress.unlocked || 1;
      var done = (progress.completed || {})[level.levelId] || game.win;
      levelLabel.textContent =
        "关卡 " + (currentIdx + 1) + " / " + mainLevels.length +
        " · " + level.name + (done ? " ✅" : "");
      prevBtn.disabled = currentIdx <= 0;
      nextBtn.disabled =
        currentIdx >= mainLevels.length - 1 || currentIdx + 1 >= unlockedCount;
    }

    if (game.rotationTokensLeft > 0) {
      tokenBadge.textContent = "🔑 旋转名额 ×" + game.rotationTokensLeft;
      tokenBadge.classList.remove("hidden");
    } else {
      tokenBadge.classList.add("hidden");
    }

    // 通关后提示按钮停用（无事可提示）
    hintBtn.disabled = !!game.win;

    // 选中贴纸 → 操作面板
    var sel = game.getSelected();
    actionPanel.classList.add("hidden");
    if (sel && !game.win) {
      var canUnlock = game.rotationTokensLeft > 0 && !sel.rotationAbility;
      var canRotate = sel.rotationAbility;
      if (canUnlock || canRotate) {
        actionPanel.classList.remove("hidden");
        unlockBtn.classList.toggle("hidden", !canUnlock);
        rotateBtn.classList.toggle("hidden", !canRotate);
        if (canUnlock) {
          unlockBtn.textContent = "🔓 解锁旋转（剩 " + game.rotationTokensLeft + "）";
        }
        var sticker = STICKERS[sel.stickerId];
        deselectBtn.textContent = "✕ " + (sticker ? sticker.name : "");
      }
    }
  }

  // ---------- 通关结算 ----------
  function showWin() {
    updateHUD(); // 通关瞬间 _checkWin 在 emitChange 之后，这里补一次（停用提示按钮等）
    var stickerCells = game.pieces.reduce(function (s, p) { return s + Geometry.cellsAtRotation(p.shapeCells, p.rotation).length; }, 0);
    winTitle.textContent = "🎉 收纳完成！";
    winSub.textContent = (isTestMode ? "测试关" : "第 " + (currentIdx + 1) + " 关 · " + game.level.name) +
      "　贴纸 " + game.pieces.length + " 张 / " + stickerCells + " 格";
    if (!isTestMode && currentIdx < mainLevels.length - 1) {
      winNextBtn.classList.remove("hidden");
    } else {
      winNextBtn.classList.add("hidden");
      if (!isTestMode && currentIdx >= mainLevels.length - 1) {
        winSub.textContent += "　（M1 原型到此为止，更多关卡制作中）";
      }
    }
    winOverlay.classList.remove("hidden");
  }

  function hideWin() { winOverlay.classList.add("hidden"); }

  // ---------- 气泡提示 ----------
  var toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.classList.add("hidden"); }, 300);
    }, 1600);
  }

  // ---------- 事件绑定 ----------
  prevBtn.addEventListener("click", function () {
    if (currentIdx > 0) loadLevel(currentIdx - 1);
  });
  nextBtn.addEventListener("click", function () {
    if (currentIdx < mainLevels.length - 1) loadLevel(currentIdx + 1);
  });
  resetBtn.addEventListener("click", function () {
    game.reset();
    renderer.clearHint(); // 重置后提示不再有意义
    if (!isTestMode) {
      var p = loadProgress();
      p.layouts = p.layouts || {};
      delete p.layouts[game.level.levelId];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
    }
    renderer.render();
    updateHUD();
    showToast("已重置本关");
  });
  unlockBtn.addEventListener("click", function () {
    var sel = game.getSelected();
    if (!sel) return;
    var res = game.grantRotationAbility(sel);
    if (!res.ok) {
      var unlockMsgs = {
        no_tokens: "旋转名额用完啦",
        already: "这张贴纸已经解锁过旋转了",
        finished: "本关已完成",
      };
      showToast(unlockMsgs[res.reason] || "解锁失败");
    }
    updateHUD();
  });
  rotateBtn.addEventListener("click", function () {
    var sel = game.getSelected();
    if (!sel) return;
    var res = game.tryRotate(sel);
    if (!res.ok) {
      showToast(res.reason === "no_ability" ? "这张贴纸还没有旋转能力" : "转到这个方向会违反规则：" + reasonText(res));
      if (sel.placed) renderer.showInvalidFlash(sel, sel.x, sel.y, res);
    }
    updateHUD();
  });
  deselectBtn.addEventListener("click", function () {
    game.select(null);
    updateHUD();
    renderer.render();
  });

  // ---------- 提示系统（M2，需求 §5：三种提示随机出现） ----------
  // 去重（补丁五）：同一布局下，看过的提示不再重复出现。
  // 布局签名 = 序列化局面（含位置/方向/能力/名额）；选中贴纸不改签名。
  var hintBusy = false;
  var hintSeen = []; // 当前布局已展示过的提示 key
  var hintSig = null; // 展示这些 key 时的布局签名

  hintBtn.addEventListener("click", function () {
    if (!game || game.win || hintBusy) return;
    hintBusy = true;
    hintBtn.disabled = true;
    hintBtn.textContent = "💡 思考中…";
    // 让按钮先重绘再跑同步求解，避免"点了没反应"的观感
    setTimeout(function () {
      var sig = JSON.stringify(game.serialize());
      var seen = (hintSig === sig && hintSeen.length) ? hintSeen.slice() : null;
      var hint;
      try {
        hint = HintManager.getHint(game, { budgetMs: 3000, seen: seen });
      } catch (e) {
        hint = { type: 0, reason: "error" };
      }
      // 记录已展示内容（超时/错误不记录——重试是自然操作）
      var key = hint ? HintManager.contentKey(hint) : null;
      if (key != null) {
        if (hintSig !== sig) { hintSig = sig; hintSeen = []; }
        if (hintSeen.indexOf(key) === -1) hintSeen.push(key);
      }
      hintBusy = false;
      hintBtn.disabled = false;
      hintBtn.textContent = "💡 提示";
      applyHint(hint);
    }, 30);
  });

  function applyHint(h) {
    if (!h || h.type === 0) {
      if (h && h.reason === "exhausted") {
        showToast("这个布局的提示都出现过啦——动一动贴纸，再来要新提示吧~");
      } else {
        showToast("提示出了点小状况，再点一次试试~");
      }
      return;
    }
    if (h.type === 1) {
      if (h.ok) {
        renderer.showHintFlash(h.piece, h.x, h.y, h.rotation, 2000);
        var name = h.piece.sticker.name;
        if (h.needsRotationUnlock) {
          showToast("「" + name + "」转个方向能贴到这里，需要先解锁旋转（花一个名额）");
        } else if (h.needsRotate) {
          showToast("「" + name + "」先在托盘里转个方向，再贴到这里");
        } else {
          showToast("试试把「" + name + "」贴到这里");
        }
      } else if (h.reason === "timeout") {
        showToast("提示卡住了，再点一次试试~");
      } else {
        // Hint 1 保留全部已放置贴纸：无解 = 布局死局
        renderer.showBoardPulse(false, 1400);
        showToast("当前布局已经无法完成了，调整一下吧~");
      }
    } else if (h.type === 2) {
      if (h.ok) {
        renderer.showHintFlash(h.piece, h.piece.x, h.piece.y, h.piece.rotation, 2000);
        showToast("「" + h.piece.sticker.name + "」现在的位置没问题，放心保留~");
      } else if (h.reason === "timeout") {
        showToast("提示卡住了，再点一次试试~");
      } else {
        renderer.showBoardPulse(false, 1400);
        showToast("当前贴纸的位置没有一个是合适的。");
      }
    } else if (h.type === 3) {
      renderer.showBoardPulse(h.ok, 1400);
      showToast(h.ok ? "当前布局可以继续完成哟！" : "当前布局已经无法完成了，调整一下吧~");
    }
  }

  winNextBtn.addEventListener("click", function () {
    hideWin();
    loadLevel(currentIdx + 1, { fresh: false });
  });
  winReplayBtn.addEventListener("click", function () {
    hideWin();
    game.reset();
    renderer.render();
    updateHUD();
  });
  winCloseBtn.addEventListener("click", hideWin);
  testLink.addEventListener("click", function (e) {
    e.preventDefault();
    loadTestLevel();
  });
  window.addEventListener("resize", function () {
    renderer.layout();
    renderer.render();
  });

  // ---------- 启动 ----------
  var params = new URLSearchParams(location.search);
  if (params.get("level") === "test" || params.get("level") === String(testLevel.levelId)) {
    loadTestLevel();
  } else {
    var p = loadProgress();
    var start = Math.min(Math.max(0, p.current || 0), mainLevels.length - 1);
    loadLevel(start);
  }

  // 调试钩子（自动化验证 / 控制台排查用，不影响正常玩法）
  window.__PS_DEBUG = {
    get game() { return game; },
    get renderer() { return renderer; },
    get input() { return input; },
    loadLevel: loadLevel,
    loadTestLevel: loadTestLevel,
    mainLevels: mainLevels,
  };
})();
