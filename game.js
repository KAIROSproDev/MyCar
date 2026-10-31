
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const screens = document.querySelectorAll(".screen");

let currentLevel = 1;
let completed = Number(localStorage.getItem("completed") || 0);
let totalKills = Number(localStorage.getItem("kills") || 0);
let bestScore = Number(localStorage.getItem("bestScore") || 0);

let score = 0;
let kills = 0;
let ammo = 5;
let maxAmmo = 5;
let timeLeft = 60;
let gameRunning = false;
let paused = false;
let ducks = [];
let particles = [];
let lastTime = 0;
let spawnTimer = 0;
let reloadTimer = null;

const regions = [
    "FLORESTA TEMPERADA",
    "PÂNTANO",
    "LAGO DAS MONTANHAS",
    "FLORESTA NEVADA",
    "PLANÍCIE",
    "RIO SELVAGEM",
    "FLORESTA TROPICAL",
    "COSTA",
    "VALE SOMBRIO",
    "RESERVA FINAL"
];

function showScreen(id) {
    screens.forEach(screen => screen.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

function updateRecords() {
    document.getElementById("completedCount").textContent = completed;
    document.getElementById("duckCount").textContent = totalKills;
    document.getElementById("bestScore").textContent = bestScore;
    document.getElementById("progressText").textContent = completed + "/100";
}

function buildLevels() {
    const grid = document.getElementById("levelGrid");
    grid.innerHTML = "";

    for (let i = 1; i <= 100; i++) {
        const button = document.createElement("button");
        button.textContent = i.toString().padStart(2, "0");
        button.className = "level-button";

        if (i > completed + 1) {
            button.classList.add("locked");
            button.disabled = true;
        } else {
            button.addEventListener("click", () => startGame(i));
        }

        grid.appendChild(button);
    }

    updateRecords();
}

document.getElementById("playBtn").addEventListener("click", () => {
    startGame(Math.min(completed + 1, 100));
});

document.getElementById("levelsBtn").addEventListener("click", () => {
    buildLevels();
    showScreen("levels");
});

document.getElementById("recordsBtn").addEventListener("click", () => {
    updateRecords();
    showScreen("records");
});

document.querySelectorAll(".backBtn").forEach(button => {
    button.addEventListener("click", () => showScreen("menu"));
});

function startGame(level) {
    currentLevel = level;
    score = 0;
    kills = 0;
    ammo = maxAmmo;
    timeLeft = Math.max(30, 60 - Math.floor(level / 10) * 3);
    ducks = [];
    particles = [];
    spawnTimer = 0;
    paused = false;
    gameRunning = true;

    document.getElementById("hudLevel").textContent =
        currentLevel.toString().padStart(2, "0");

    document.getElementById("gameMessage").style.display = "none";

    showScreen("gameScreen");
    updateHUD();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateHUD() {
    document.getElementById("score").textContent = score;
    document.getElementById("kills").textContent = kills;
    document.getElementById("ammo").textContent = ammo + "/" + maxAmmo;
    document.getElementById("timer").textContent = Math.ceil(timeLeft);
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function spawnDuck() {
    const direction = Math.random() > .5 ? 1 : -1;

    ducks.push({
        x: direction === 1 ? -70 : canvas.width + 70,
        y: random(130, 330),
        speed: random(90, 170) + currentLevel * 2,
        direction,
        size: random(.85, 1.2),
        color: ["#75533b", "#a77b45", "#d2b68b", "#333c32"][
            Math.floor(Math.random() * 4)
        ],
        alive: true,
        phase: random(0, Math.PI * 2)
    });
}

function drawBackground() {
    const region = Math.floor((currentLevel - 1) / 10);

    const skies = [
        ["#92b8b3", "#d4d2a2"],
        ["#758f82", "#b0a47b"],
        ["#7c9fae", "#d4d7c5"],
        ["#8397a2", "#d8e2df"],
        ["#b1b58a", "#e4d6a2"],
        ["#719b9a", "#c1c6a1"],
        ["#507d59", "#b1b57d"],
        ["#80a8aa", "#d7c9a1"],
        ["#475c4d", "#8a9877"],
        ["#394b45", "#a0a88c"]
    ];

    const colors = skies[region];
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sol
    ctx.fillStyle = "#e8dca7";
    ctx.globalAlpha = .65;
    ctx.beginPath();
    ctx.arc(760, 110, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Montanhas distantes
    ctx.fillStyle = "#506a54";
    ctx.beginPath();
    ctx.moveTo(0, 300);

    for (let x = 0; x <= canvas.width; x += 100) {
        ctx.lineTo(x, random(190, 270));
    }

    ctx.lineTo(canvas.width, 400);
    ctx.lineTo(0, 400);
    ctx.fill();

    // Árvores ao fundo
    for (let i = 0; i < 22; i++) {
        const x = i * 48;
        const h = 90 + (i % 5) * 15;

        ctx.fillStyle = "#354d37";
        ctx.fillRect(x + 15, 300 - h, 12, h);

        ctx.fillStyle = i % 2 ? "#29452f" : "#3e603c";
        ctx.beginPath();
        ctx.moveTo(x - 15, 300 - h + 35);
        ctx.lineTo(x + 21, 300 - h - 35);
        ctx.lineTo(x + 57, 300 - h + 35);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x - 10, 300 - h + 10);
        ctx.lineTo(x + 21, 300 - h - 60);
        ctx.lineTo(x + 52, 300 - h + 10);
        ctx.fill();
    }

    // Vegetação próxima
    ctx.fillStyle = "#344a2e";
    ctx.fillRect(0, 400, canvas.width, 140);

    ctx.fillStyle = "#52683a";
    for (let i = 0; i < 100; i++) {
        const x = (i * 37) % canvas.width;
        const y = 410 + (i * 19) % 120;
        ctx.fillRect(x, y, 3, 10 + (i % 5) * 3);
    }

    // Silhueta do caçador
    drawHunter();
}

function drawHunter() {
    // Corpo
    ctx.fillStyle = "#202d24";
    ctx.beginPath();
    ctx.ellipse(480, 510, 52, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mochila
    ctx.fillStyle = "#536347";
    ctx.fillRect(451, 455, 58, 48);

    // Cabeça
    ctx.fillStyle = "#bd9472";
    ctx.beginPath();
    ctx.arc(480, 445, 20, 0, Math.PI * 2);
    ctx.fill();

    // Boné
    ctx.fillStyle = "#35432f";
    ctx.fillRect(460, 426, 40, 10);
    ctx.fillRect(469, 416, 24, 12);

    // Ombros
    ctx.fillStyle = "#354c37";
    ctx.fillRect(423, 475, 114, 27);

    // Arma
    ctx.fillStyle = "#292b25";
    ctx.fillRect(510, 468, 75, 7);
    ctx.fillRect(523, 475, 12, 22);
}

function drawDuck(duck) {
    const s = duck.size;

    ctx.save();
    ctx.translate(duck.x, duck.y);
    ctx.scale(duck.direction, 1);
    ctx.scale(s, s);

    // Asas
    ctx.fillStyle = "#4d4937";
    ctx.beginPath();
    ctx.ellipse(-5, 0, 21, 11 + Math.sin(duck.phase) * 4, -.2, 0, Math.PI * 2);
    ctx.fill();

    // Corpo
    ctx.fillStyle = duck.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pescoço
    ctx.strokeStyle = duck.color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(18, -3);
    ctx.lineTo(26, -17);
    ctx.stroke();

    // Cabeça
    ctx.fillStyle = "#384c32";
    ctx.beginPath();
    ctx.arc(28, -19, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bico
    ctx.fillStyle = "#d7a34a";
    ctx.beginPath();
    ctx.moveTo(35, -19);
    ctx.lineTo(47, -16);
    ctx.lineTo(35, -13);
    ctx.fill();

    // Olho
    ctx.fillStyle = "#090d09";
    ctx.fillRect(30, -21, 2, 2);

    // Cauda
    ctx.fillStyle = "#4b4434";
    ctx.beginPath();
    ctx.moveTo(-23, -4);
    ctx.lineTo(-36, -12);
    ctx.lineTo(-30, 2);
    ctx.fill();

    ctx.restore();
}

function drawCrosshair(x, y) {
    ctx.save();
    ctx.strokeStyle = "#f3f1df";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 5;

    const gap = 9;
    const length = 13;

    ctx.beginPath();
    ctx.moveTo(x - gap - length, y);
    ctx.lineTo(x - gap, y);

    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + length, y);

    ctx.moveTo(x, y - gap - length);
    ctx.lineTo(x, y - gap);

    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + length);

    ctx.stroke();
    ctx.restore();
}

let mouse = { x: 480, y: 250 };

canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();

    mouse.x = (event.clientX - rect.left) * canvas.width / rect.width;
    mouse.y = (event.clientY - rect.top) * canvas.height / rect.height;
});

function shoot() {
    if (!gameRunning || paused || ammo <= 0) return;

    ammo--;
    updateHUD();

    let hit = false;

    for (let i = ducks.length - 1; i >= 0; i--) {
        const duck = ducks[i];

        const dx = mouse.x - duck.x;
        const dy = mouse.y - duck.y;

        if (Math.sqrt(dx * dx + dy * dy) < 35 * duck.size) {
            ducks.splice(i, 1);
            kills++;
            score += 100 + currentLevel * 5;
            totalKills++;
            hit = true;
            createParticles(mouse.x, mouse.y);
            break;
        }
    }

    if (!hit) score = Math.max(0, score - 10);

    updateHUD();

    if (ammo === 0) {
        document.getElementById("ammo").textContent = "VAZIO";
    }
}

canvas.addEventListener("click", shoot);

function createParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x,
            y,
            vx: random(-100, 100),
            vy: random(-100, 100),
            life: random(.3, .7)
        });
    }
}

function drawParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.life -= delta;

        ctx.fillStyle = "#e8d69c";
        ctx.fillRect(p.x, p.y, 4, 4);

        if (p.life <= 0) particles.splice(i, 1);
    }
}

function reload() {
    if (!gameRunning || paused || ammo === maxAmmo) return;

    ammo = maxAmmo;
    updateHUD();
}

function togglePause() {
    if (!gameRunning) return;

    paused = !paused;

    if (paused) {
        showMessage("JOGO PAUSADO", "A caçada está suspensa.", "CONTINUAR", () => {
            paused = false;
            document.getElementById("gameMessage").style.display = "none";
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        });
    } else {
        document.getElementById("gameMessage").style.display = "none";
    }
}

function showMessage(title, text, buttonText, callback) {
    const box = document.getElementById("gameMessage");

    document.getElementById("messageTitle").textContent = title;
    document.getElementById("messageText").textContent = text;

    const button = document.getElementById("messageButton");
    button.textContent = buttonText;
    button.onclick = callback;

    box.style.display = "block";
}

function finishGame() {
    gameRunning = false;

    const won = kills >= 5 + Math.floor(currentLevel / 5);

    if (won) {
        completed = Math.max(completed, currentLevel);
        bestScore = Math.max(bestScore, score);

        localStorage.setItem("completed", completed);
        localStorage.setItem("bestScore", bestScore);
        localStorage.setItem("kills", totalKills);
    }

    const title = won ? "FASE CONCLUÍDA" : "CAÇADA ENCERRADA";
    const description = won
        ? `Você abateu ${kills} patos e conquistou ${score} pontos.`
        : `Você abateu ${kills} patos. Continue treinando!`;

    showMessage(title, description, "VOLTAR AO MENU", () => {
        document.getElementById("gameMessage").style.display = "none";
        showScreen("menu");
    });
}

function gameLoop(timestamp) {
    if (!gameRunning || paused) return;

    const delta = Math.min((timestamp - lastTime) / 1000, .05);
    lastTime = timestamp;

    timeLeft -= delta;
    spawnTimer += delta;

    if (spawnTimer > Math.max(.5, 2 - currentLevel * .012)) {
        spawnDuck();
        spawnTimer = 0;
    }

    ducks.forEach(duck => {
        duck.x += duck.speed * duck.direction * delta;
        duck.phase += delta * 10;
    });

    ducks = ducks.filter(duck =>
        duck.x > -100 && duck.x < canvas.width + 100
    );

    drawBackground();

    ducks.forEach(drawDuck);
    drawParticles(delta);
    drawCrosshair(mouse.x, mouse.y);

    updateHUD();

    if (timeLeft <= 0) {
        finishGame();
        return;
    }

    requestAnimationFrame(gameLoop);
}

document.getElementById("reloadBtn").addEventListener("click", reload);
document.getElementById("pauseBtn").addEventListener("click", togglePause);

document.getElementById("messageButton").addEventListener("click", () => {});

document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "r") reload();
    if (event.key === "Escape") togglePause();
});

buildLevels();
showScreen("menu");
