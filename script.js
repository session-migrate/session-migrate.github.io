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
  const duration = 17_000;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phaseLabel = trajectory.querySelector("[data-trajectory-phase]");
  const stateLabel = trajectory.querySelector("[data-trajectory-state]");
  const progress = trajectory.querySelector("[data-trajectory-progress]");
  const pauseButton = trajectory.querySelector('[data-trajectory-action="pause"]');
  const replayButton = trajectory.querySelector('[data-trajectory-action="replay"]');
  const lines = [...trajectory.querySelectorAll(".trajectory-line")];
  let elapsed = motion.matches ? duration - 1 : 0;
  let paused = motion.matches;
  let reduced = motion.matches;
  let inView = false;
  let previous = performance.now();

  const phaseFor = (value) => {
    if (value < 2_050) return "command";
    if (value < 4_550) return "inspect";
    if (value < 9_650) return "mapping";
    if (value < 11_650) return "writing";
    return "ready";
  };

  const renderTrajectory = () => {
    const phase = phaseFor(elapsed);
    trajectory.dataset.phase = phase;
    phaseLabel.textContent = phase;
    stateLabel.textContent = phase === "ready" ? "complete" : "running";
    progress.style.width = `${Math.min(100, elapsed / duration * 100)}%`;

    for (const line of lines) {
      const at = Number(line.dataset.at);
      const text = line.dataset.text;
      const visible = reduced || elapsed >= at;
      const code = line.querySelector("code");
      const cursor = line.querySelector(".trajectory-cursor");
      line.classList.toggle("is-visible", visible);
      if (line.dataset.typed === "true" && !reduced) {
        const length = Math.max(0, Math.floor((elapsed - at) / 22));
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

  const tick = (now) => {
    const delta = Math.min(100, now - previous);
    previous = now;
    if (!paused && !reduced && inView) elapsed = (elapsed + delta) % duration;
    renderTrajectory();
    window.requestAnimationFrame(tick);
  };

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

  renderTrajectory();
  window.requestAnimationFrame(tick);
}
