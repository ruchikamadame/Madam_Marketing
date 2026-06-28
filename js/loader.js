// ========================================
// PAGE LOADER
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("pageLoader");
  const body = document.body;

  // Minimum display time for loader (2.5 seconds)
  const minLoadTime = 2500;
  const startTime = Date.now();

  // Wait for page to fully load
  window.addEventListener("load", () => {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minLoadTime - elapsedTime);

    setTimeout(() => {
      // Fade out loader
      loader.classList.add("fade-out");

      // Remove loader and enable scrolling after fade completes
      setTimeout(() => {
        loader.style.display = "none";
        body.classList.remove("loading");
      }, 600);
    }, remainingTime);
  });
});
