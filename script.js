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
