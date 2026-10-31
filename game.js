
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

let mouse = { x: 480, y: 270 };
let shots = 0;

function draw() {
  ctx.fillStyle = "#9acb91";
  ctx.fillRect(0, 0, 960, 540);

  // Céu
  ctx.fillStyle = "#7eb8d8";
  ctx.fillRect(0, 0, 960, 280);

  // Sol pixelado
  ctx.fillStyle = "#ffe58a";
  ctx.fillRect(760, 55, 64, 64);

  // Montanhas
  ctx.fillStyle = "#526d64";
  ctx.beginPath();
  ctx.moveTo(0, 280);
  ctx.lineTo(180, 120);
  ctx.lineTo(360, 280);
  ctx.lineTo(560, 150);
  ctx.lineTo(780, 280);
  ctx.lineTo(960, 170);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.fill();

  // Gramado
  ctx.fillStyle = "#456b38";
  ctx.fillRect(0, 350, 960, 190);

  // Personagem visto de costas
  ctx.fillStyle = "#292f35";
  ctx.fillRect(425, 390, 110, 100);
  ctx.fillStyle = "#d9ad82";
  ctx.fillRect(450, 345, 60, 55);
  ctx.fillStyle = "#3b424a";
  ctx.fillRect(435, 330, 90, 25);

  // Mira de quatro traços
  ctx.strokeStyle = "#fff4bd";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mouse.x - 18, mouse.y);
  ctx.lineTo(mouse.x - 7, mouse.y);
  ctx.moveTo(mouse.x + 7, mouse.y);
  ctx.lineTo(mouse.x + 18, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 18);
  ctx.lineTo(mouse.x, mouse.y - 7);
  ctx.moveTo(mouse.x, mouse.y + 7);
  ctx.lineTo(mouse.x, mouse.y + 18);
  ctx.stroke();

  // HUD
  ctx.fillStyle = "#14231d";
  ctx.fillRect(15, 15, 220, 65);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px monospace";
  ctx.fillText("DUCK HUNTER", 28, 42);
  ctx.font = "16px monospace";
  ctx.fillText(`DISPAROS: ${shots}`, 28, 65);
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * canvas.width / rect.width;
  mouse.y = (event.clientY - rect.top) * canvas.height / rect.height;
});

canvas.addEventListener("click", () => {
  shots++;
});

function loop() {
  draw();
  requestAnimationFrame(loop);
}

loop();
