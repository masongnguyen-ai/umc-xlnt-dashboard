const INTERVAL = 10 * 60 * 1000;

function loop() {
  postMessage({ type: "tick", at: Date.now() });
  setTimeout(loop, INTERVAL);
}

setTimeout(loop, INTERVAL);
