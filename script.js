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

const trajectory = document.querySelector("[data-trajectory]");
if (trajectory) {
  const durations = { pi: 80_280, codex: 91_320 };
  let duration = durations.pi;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phaseLabel = trajectory.querySelector("[data-trajectory-phase]");
  const stateLabel = trajectory.querySelector("[data-trajectory-state]");
  const stageLabel = trajectory.querySelector("[data-demo-stage-label]");
  const targetLabel = trajectory.querySelector("[data-demo-target-label]");
  const targetNative = trajectory.querySelector("[data-demo-target-native]");
  const progress = trajectory.querySelector("[data-trajectory-progress]");
  const lineContainer = trajectory.querySelector("[data-trajectory-lines]");
  const pauseButton = trajectory.querySelector('[data-trajectory-action="pause"]');
  const replayButton = trajectory.querySelector('[data-trajectory-action="replay"]');
  const afterImage = document.querySelector("[data-demo-after-image]");
  const afterCaption = document.querySelector("[data-demo-after-caption]");
  const durationLabel = document.querySelector("[data-demo-duration]");
  let target = "pi";
  let elapsed = motion.matches ? duration - 1 : 0;
  let paused = motion.matches;
  let reduced = motion.matches;
  let inView = false;
  let previous = performance.now();

  const details = {
    pi: { label: "Pi", native: "native v3 JSONL", reply: "3 tests passed · patch applied in Pi", resume: "pi --session 20000000-…", image: "/assets/demo-after-pi.png?v=4", duration: durations.pi },
    codex: { label: "Codex", native: "native rollout JSONL", reply: "3 tests passed · patch applied in Codex", resume: "codex resume 30000000-…", image: "/assets/demo-after-codex.png?v=4", duration: durations.codex },
  };

  const linesFor = (value) => {
    const item = details[value];
    const finishAt = value === "pi" ? 74000 : 85000;
    return [
      [250, "meta", "CLAUDE", "native session · timeline project loaded", false],
      [900, "command", "YOU", "Keep gap_ms=0 backward compatible. Propose the smallest patch and one regression test that separates touching events from a real 1 ms gap.", true],
      [9000, "meta", "CLAUDE", "reviews timeline.py and the focused tests…", false],
      [17000, "history", "CLAUDE", "Boundary diagnosis: gap < gap_ms excludes touching events when gap_ms is zero.", false],
      [34000, "history", "CLAUDE", "Smallest patch: change < to <=; test gap 0 against a real 1 ms gap.", false],
      [43000, "command", "❯", `smigrate transfer 10000000-… --from claude --to ${value}`, true],
      [47500, "success", "✓", `native ${item.label} session created · source unchanged`, false],
      [50000, "meta", item.label.toUpperCase(), "migrated history opened in the native TUI", false],
      [51500, "history", "YOU", "Keep gap_ms=0 backward compatible…", false],
      [53000, "history", "CLAUDE", "Change < to <= and add a touching-vs-1ms regression test.", false],
      [55000, "command", "YOU", `Continue in ${item.label}: implement the patch, add the regression test, and run the focused suite.`, true],
      [64000, "meta", item.label.toUpperCase(), "reads timeline.py · applies one-line fix · adds regression", false],
      [finishAt, "success", item.label.toUpperCase(), item.reply, false],
      [item.duration - 2500, "success", "RESUME", item.resume, false],
    ];
  };

  const phaseFor = (value) => {
    if (value < 43000) return "claude";
    if (value < 50000) return "migrate";
    if (value < 55000) return "review";
    if (value < duration - 4500) return "continue";
    return "ready";
  };

  const buildLines = () => {
    lineContainer.replaceChildren();
    for (const [at, kind, prefix, text, typed] of linesFor(target)) {
      const line = document.createElement("div");
      line.className = `trajectory-line ${kind}`;
      line.dataset.at = String(at);
      line.dataset.text = text;
      if (typed) line.dataset.typed = "true";
      const prefixElement = document.createElement("span");
      prefixElement.textContent = prefix;
      const code = document.createElement("code");
      code.textContent = text;
      line.append(prefixElement, code);
      if (typed) {
        const cursor = document.createElement("i");
        cursor.className = "trajectory-cursor";
        line.append(cursor);
      }
      lineContainer.append(line);
    }
  };

  const renderTrajectory = () => {
    const phase = phaseFor(elapsed);
    const item = details[target];
    trajectory.dataset.phase = phase;
    trajectory.dataset.target = target;
    phaseLabel.textContent = phase;
    stateLabel.textContent = phase === "ready" ? "continued" : "live · 1×";
    stageLabel.textContent = phase === "claude" ? "Claude Code" : phase === "migrate" ? "session-migrate" : item.label;
    targetLabel.textContent = item.label;
    targetNative.textContent = item.native;
    progress.style.width = `${Math.min(100, elapsed / duration * 100)}%`;

    for (const line of lineContainer.querySelectorAll(".trajectory-line")) {
      const at = Number(line.dataset.at);
      const text = line.dataset.text;
      const visible = reduced || elapsed >= at;
      const code = line.querySelector("code");
      const cursor = line.querySelector(".trajectory-cursor");
      line.classList.toggle("is-visible", visible);
      if (line.dataset.typed === "true" && !reduced) {
        const length = Math.max(0, Math.floor((elapsed - at) / 45));
        code.textContent = visible ? text.slice(0, length) : "";
        if (cursor) cursor.hidden = !visible || length >= text.length;
      } else {
        code.textContent = text;
        if (cursor) cursor.hidden = true;
      }
    }

    pauseButton.textContent = reduced ? "Play" : paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-label", paused ? "Resume trajectory animation" : "Pause trajectory animation");
  };

  const selectTarget = (value) => {
    target = value;
    reduced = false;
    paused = false;
    elapsed = 0;
    for (const button of document.querySelectorAll("[data-demo-target]")) {
      const active = button.dataset.demoTarget === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const item = details[value];
    duration = item.duration;
    durationLabel.textContent = `loops in ${Math.round(duration / 1000)} seconds`;
    afterImage.src = item.image;
    afterImage.alt = `${item.label} native TUI after migration from Claude Code`;
    afterCaption.textContent = `After · ${item.label} TUI`;
    buildLines();
    renderTrajectory();
  };

  const tick = (now) => {
    const delta = Math.min(100, now - previous);
    previous = now;
    if (!paused && !reduced && inView) elapsed = (elapsed + delta) % duration;
    renderTrajectory();
    window.requestAnimationFrame(tick);
  };

  for (const button of document.querySelectorAll("[data-demo-target]")) {
    button.addEventListener("click", () => selectTarget(button.dataset.demoTarget));
  }

  pauseButton.addEventListener("click", () => {
    if (reduced) {
      reduced = false;
      elapsed = 0;
      paused = false;
    } else {
      paused = !paused;
    }
    renderTrajectory();
  });

  replayButton.addEventListener("click", () => {
    reduced = false;
    elapsed = 0;
    paused = false;
    renderTrajectory();
  });

  motion.addEventListener("change", (event) => {
    reduced = event.matches;
    paused = event.matches;
    elapsed = event.matches ? duration - 1 : 0;
    renderTrajectory();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0.25 },
    );
    observer.observe(trajectory);
  } else {
    inView = true;
  }

  buildLines();
  renderTrajectory();
  window.requestAnimationFrame(tick);
}
