for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const label = button.querySelector("b");
    const originalLabel = label.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = "Copied";
      window.setTimeout(() => { label.textContent = originalLabel; }, 1600);
    } catch {
      label.textContent = "Select";
    }
  });
}

const agentPrompt = document.querySelector("[data-agent-prompt]");
if (agentPrompt) {
  const source = agentPrompt.querySelector("[data-agent-prompt-source]");
  const target = agentPrompt.querySelector("[data-agent-prompt-target]");
  const output = agentPrompt.querySelector("[data-agent-prompt-output]");
  const copyButton = agentPrompt.querySelector("[data-agent-prompt-copy]");
  const labels = {
    claude: "Claude Code",
    codex: "Codex",
    pi: "Pi",
    opencode: "OpenCode",
    copilot: "Copilot",
    antigravity: "Antigravity",
    cursor: "Cursor",
  };

  const updatePrompt = () => {
    output.textContent = `Follow https://session-migrate.github.io/llms.txt to migrate a session from ${labels[source.value]} to ${labels[target.value]}. Session: [UUID OR TITLE]`;
  };

  source.addEventListener("change", updatePrompt);
  target.addEventListener("change", updatePrompt);
  copyButton.addEventListener("click", async () => {
    const originalLabel = copyButton.textContent;
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyButton.textContent = "Copied";
      window.setTimeout(() => { copyButton.textContent = originalLabel; }, 1600);
    } catch {
      copyButton.textContent = "Select text";
    }
  });
}

const trajectory = document.querySelector("[data-trajectory]");
if (trajectory) {
  const DURATION = 43;
  const TARGET_START = 17.5;
  const HIGHLIGHT_START = 20;
  const SHARED_HISTORY_START = 'So I read "backward compatible"';
  const SHARED_HISTORY_END = "two distinguishable cases.";
  const grid = trajectory.querySelector("[data-handoff-grid]");
  const viewport = trajectory.querySelector("[data-handoff-viewport]");
  const sourceMount = trajectory.querySelector("[data-source-cast]");
  const targetMount = trajectory.querySelector("[data-target-cast]");
  const progress = trajectory.querySelector("[data-trajectory-progress]");
  const pauseButton = trajectory.querySelector('[data-trajectory-action="pause"]');
  const replayButton = trajectory.querySelector('[data-trajectory-action="replay"]');
  const stageLabel = trajectory.querySelector("[data-demo-stage]");
  const commandNode = trajectory.querySelector("[data-migration-command]");
  const launchNode = trajectory.querySelector("[data-migration-launch]");
  const launchCommandNode = trajectory.querySelector("[data-migration-launch-command]");
  const scanNode = trajectory.querySelector("[data-migration-scan]");
  const writeNode = trajectory.querySelector("[data-migration-write]");
  const doneNode = trajectory.querySelector("[data-migration-done]");
  const migrationState = trajectory.querySelector("[data-migration-state]");
  const comparison = document.querySelector(".snapshots");
  const compareSourceMount = comparison.querySelector("[data-compare-source]");
  const compareTargetMount = comparison.querySelector("[data-compare-target]");
  const compareTargetLabel = comparison.querySelector("[data-compare-target-label]");
  const afterCaption = document.querySelector("[data-demo-after-caption]");
  let target = "pi";
  let sourcePlayer = null;
  let targetPlayer = null;
  let compareSourcePlayer = null;
  let compareTargetPlayer = null;
  let elapsed = 0;
  let playing = true;
  let visible = true;
  let lastFrame = 0;
  let historyAnchorScheduled = false;

  const details = {
    pi: {
      label: "Pi",
      cast: "/assets/demo-pi.cast",
      launch: "pi --session 2000…0000",
      compareAt: 20,
    },
    codex: {
      label: "Codex",
      cast: "/assets/demo-codex.cast",
      launch: "codex resume 3000…0000",
      compareAt: 26,
    },
  };

  const phaseAt = (time) => {
    if (time < 8) return "source";
    if (time < 10.5) return "pullback";
    if (time < 16) return "convert";
    if (time < 18.5) return "launch";
    if (time < 23.5) return "overlap";
    return "target";
  };

  const safe = (fn) => {
    try { fn(); } catch (_) {}
  };

  const anchorSharedHistory = (mount) => {
    const windowElement = mount.closest(".native-window");
    const marker = windowElement && windowElement.querySelector(".history-marker");
    if (!windowElement || !marker) return false;
    const lines = Array.from(mount.querySelectorAll(".ap-line"));
    const startIndex = lines.findIndex((line) => line.textContent.includes(SHARED_HISTORY_START));
    const endIndex = lines.findIndex(
      (line, index) => index >= startIndex && line.textContent.includes(SHARED_HISTORY_END),
    );
    if (startIndex < 0 || endIndex < startIndex) {
      marker.dataset.anchored = "false";
      return false;
    }
    const windowRect = windowElement.getBoundingClientRect();
    const startRect = lines[startIndex].getBoundingClientRect();
    const endRect = lines[endIndex].getBoundingClientRect();
    marker.style.top = `${Math.max(0, startRect.top - windowRect.top - 5)}px`;
    marker.style.height = `${endRect.bottom - startRect.top + 10}px`;
    marker.dataset.anchored = "true";
    return true;
  };

  const scheduleHistoryAnchors = () => {
    if (historyAnchorScheduled) return;
    historyAnchorScheduled = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const sourceAnchored = anchorSharedHistory(sourceMount);
        const targetAnchored = anchorSharedHistory(targetMount);
        grid.dataset.historyAligned = String(
          sourceAnchored && targetAnchored && elapsed >= HIGHLIGHT_START,
        );
        historyAnchorScheduled = false;
      });
    });
  };

  const historyObserver = new MutationObserver(scheduleHistoryAnchors);
  historyObserver.observe(sourceMount, { childList: true, characterData: true, subtree: true });
  historyObserver.observe(targetMount, { childList: true, characterData: true, subtree: true });
  const historyResizeObserver = new ResizeObserver(scheduleHistoryAnchors);
  historyResizeObserver.observe(sourceMount.closest(".native-window"));
  historyResizeObserver.observe(targetMount.closest(".native-window"));
  window.addEventListener("resize", scheduleHistoryAnchors);

  const syncPlayers = () => {
    if (!sourcePlayer || !targetPlayer) return;
    if (!playing || !visible) {
      safe(() => sourcePlayer.pause());
      safe(() => targetPlayer.pause());
    } else if (elapsed < TARGET_START) {
      safe(() => targetPlayer.pause());
      safe(() => sourcePlayer.play());
    } else {
      safe(() => sourcePlayer.pause());
      safe(() => targetPlayer.play());
    }
  };

  const update = () => {
    const detail = details[target];
    const phase = phaseAt(elapsed);
    const command = `smigrate transfer 1000…0000 --from claude --to ${target}`;
    const typing = Math.max(0, Math.min(1, (elapsed - 10.8) / 2.7));
    trajectory.dataset.phase = phase;
    grid.dataset.phase = phase;
    progress.style.width = `${elapsed / DURATION * 100}%`;
    commandNode.textContent = command.slice(0, Math.floor(command.length * typing));
    scanNode.classList.toggle("is-visible", elapsed >= 13.4);
    writeNode.classList.toggle("is-visible", elapsed >= 14.2);
    doneNode.classList.toggle("is-visible", elapsed >= 15);
    launchNode.classList.toggle("is-visible", elapsed >= 15);
    migrationState.textContent = elapsed >= 15 ? "complete" : "working";
    stageLabel.textContent = phase === "source" ? "Start in Claude" : phase === "convert" ? "Migrate" : phase === "overlap" ? "Same history" : `Continue in ${detail.label}`;
    if (phase === "overlap") scheduleHistoryAnchors();
  };

  const updatePlaybackState = () => {
    pauseButton.textContent = playing ? "Pause" : "Play";
    pauseButton.setAttribute("aria-label", playing ? "Pause the migration story" : "Play the migration story");
  };

  const setTime = (time) => {
    elapsed = Math.max(0, Math.min(DURATION, time));
    safe(() => sourcePlayer.seek(elapsed * 2));
    safe(() => targetPlayer.seek(Math.max(0, elapsed - TARGET_START)));
    update();
    syncPlayers();
  };

  const mountPlayers = () => {
    if (!window.AsciinemaPlayer) {
      window.setTimeout(mountPlayers, 50);
      return;
    }
    safe(() => sourcePlayer && sourcePlayer.dispose());
    safe(() => targetPlayer && targetPlayer.dispose());
    grid.dataset.historyAligned = "false";
    sourceMount.replaceChildren();
    targetMount.replaceChildren();
    const options = {
      autoPlay: false,
      controls: false,
      fit: "both",
      idleTimeLimit: 2,
      loop: false,
      theme: "asciinema",
      terminalFontFamily: "Geist Mono, monospace",
      terminalLineHeight: 1.38,
    };
    sourcePlayer = window.AsciinemaPlayer.create("/assets/demo-claude.cast", sourceMount, { ...options, speed: 2 });
    targetPlayer = window.AsciinemaPlayer.create(details[target].cast, targetMount, { ...options, speed: 1 });
    setTime(0);
  };

  const mountComparison = () => {
    if (!comparison.open) {
      safe(() => compareSourcePlayer && compareSourcePlayer.pause());
      safe(() => compareTargetPlayer && compareTargetPlayer.pause());
      return;
    }
    if (!window.AsciinemaPlayer) {
      window.setTimeout(mountComparison, 50);
      return;
    }
    safe(() => compareSourcePlayer && compareSourcePlayer.dispose());
    safe(() => compareTargetPlayer && compareTargetPlayer.dispose());
    compareSourceMount.replaceChildren();
    compareTargetMount.replaceChildren();
    const options = {
      autoPlay: false,
      controls: true,
      fit: "width",
      idleTimeLimit: 2,
      loop: false,
      theme: "asciinema",
      terminalFontFamily: "Geist Mono, monospace",
      terminalLineHeight: 1.38,
    };
    compareSourcePlayer = window.AsciinemaPlayer.create(
      "/assets/demo-claude.cast",
      compareSourceMount,
      { ...options, poster: "npt:38" },
    );
    compareTargetPlayer = window.AsciinemaPlayer.create(
      details[target].cast,
      compareTargetMount,
      { ...options, poster: `npt:${details[target].compareAt}` },
    );
  };

  const replay = () => {
    playing = true;
    lastFrame = performance.now();
    setTime(0);
    updatePlaybackState();
  };

  const selectTarget = (nextTarget) => {
    target = nextTarget;
    const detail = details[nextTarget];
    trajectory.dataset.target = nextTarget;
    for (const button of document.querySelectorAll("[data-demo-target]")) {
      const active = button.dataset.demoTarget === nextTarget;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    viewport.setAttribute("aria-label", `Claude Code session migrated to ${detail.label} and continued there`);
    for (const node of trajectory.querySelectorAll("[data-demo-target-label], [data-target-window-label], [data-demo-target-caption]")) node.textContent = detail.label;
    launchCommandNode.textContent = detail.launch;
    compareTargetLabel.textContent = detail.label;
    compareTargetMount.setAttribute("aria-label", `${detail.label} native terminal recording`);
    afterCaption.textContent = `After · ${detail.label} TUI`;
    mountPlayers();
    mountComparison();
  };

  for (const button of document.querySelectorAll("[data-demo-target]")) {
    button.addEventListener("click", () => selectTarget(button.dataset.demoTarget));
  }

  pauseButton.addEventListener("click", () => {
    playing = !playing;
    lastFrame = performance.now();
    updatePlaybackState();
    syncPlayers();
  });
  replayButton.addEventListener("click", replay);
  comparison.addEventListener("toggle", mountComparison);

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    lastFrame = performance.now();
    syncPlayers();
  }, { threshold: 0.25 });
  observer.observe(trajectory);

  const tick = (now) => {
    const previous = lastFrame || now;
    lastFrame = now;
    if (playing && visible && sourcePlayer && targetPlayer) {
      elapsed += Math.min((now - previous) / 1000, 0.12);
      if (elapsed >= DURATION) setTime(0);
      else update();
      syncPlayers();
    }
    window.requestAnimationFrame(tick);
  };

  window.__sessionMigrateDemo = {
    setTime,
    play() { playing = true; updatePlaybackState(); syncPlayers(); },
    pause() { playing = false; updatePlaybackState(); syncPlayers(); },
  };

  window.addEventListener("load", () => {
    mountPlayers();
    window.requestAnimationFrame(tick);
  });
  updatePlaybackState();
}
