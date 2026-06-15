// --- State & Config ---
let employees = [];
let balloonPhysicsList = [];
let windSpeed = 2.0;

// --- DOM Elements ---
const balloonsHolder = document.getElementById('balloons-holder');
const stringCanvas = document.getElementById('string-canvas');
const ctx = stringCanvas.getContext('2d');

// --- HSL Color Generator (Soft Pastel) ---
function generateVibrantColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 72%, 80%)`;
}

// --- Default Preset Data ---
const DEFAULT_EMPLOYEES = Array.from({ length: 120 }).map((_, i) => {
  const score = Math.floor(10 + (i / 119) * 90);
  return {
    id: (i + 1).toString(),
    name: `พนักงาน ${i + 1}`,
    score: score,
    department: 'General',
    color: generateVibrantColor()
  };
});

// --- Initialize App ---
function init() {
  loadData();
  resizeCanvas();
  syncPhysics();
  setupEventListeners();
  requestAnimationFrame(updatePhysics);
}

function loadData() {
  const stored = localStorage.getItem('employee_balloons_3d');
  if (stored) {
    try {
      employees = JSON.parse(stored);
    } catch (e) {
      employees = [...DEFAULT_EMPLOYEES];
    }
  } else {
    employees = [...DEFAULT_EMPLOYEES];
    saveData();
  }
}

function saveData() {
  localStorage.setItem('employee_balloons_3d', JSON.stringify(employees));
}

// --- Sync Physics Array with Employee Data ---
function syncPhysics() {
  const currentIds = employees.map(e => e.id);
  balloonPhysicsList = balloonPhysicsList.filter(bp => currentIds.includes(bp.id));

  employees.forEach(emp => {
    let bp = balloonPhysicsList.find(b => b.id === emp.id);
    const size = calculateBalloonSize(emp.score);

    if (bp) {
      bp.score = emp.score;
      bp.name = emp.name;
      bp.color = emp.color;
      bp.size = size;
      bp.department = emp.department || 'General';
    } else {
      const initX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
      const initY = window.innerHeight + 150;
      balloonPhysicsList.push({
        id: emp.id,
        name: emp.name,
        score: emp.score,
        department: emp.department || 'General',
        color: emp.color,
        size: size,
        x: initX,
        y: initY,
        vx: 0,
        vy: 0,
        anchorX: initX,
        anchorY: 0,
        targetY: 0,
        angle: 0
      });
    }
  });

  renderBalloonElements();
}

function calculateBalloonSize(score) {
  const minSize = 70;
  const maxSize = 140;
  return minSize + Math.min(1, score / 100) * (maxSize - minSize);
}

// --- Create DOM Balloon Elements ---
function renderBalloonElements() {
  balloonsHolder.innerHTML = '';
  const maxScore = Math.max(...balloonPhysicsList.map(b => b.score), 0);

  balloonPhysicsList.forEach(bp => {
    const balDiv = document.createElement('div');
    balDiv.className = 'balloon';
    if (bp.score === maxScore && maxScore > 0) {
      balDiv.classList.add('highest');
    }
    balDiv.id = `bal-${bp.id}`;
    balDiv.style.setProperty('--balloon-color', bp.color);
    balDiv.style.width = `${bp.size}px`;
    balDiv.style.height = `${bp.size}px`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'balloon-content';

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'balloon-score';
    scoreSpan.textContent = `${bp.score} QP`;
    scoreSpan.style.fontSize = `${Math.max(12, bp.size * 0.22)}px`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'balloon-name';
    const firstName = bp.name ? bp.name.trim().split(/\s+/)[0] : '';
    nameSpan.textContent = firstName;
    nameSpan.style.fontSize = `${Math.max(10, bp.size * 0.12)}px`;

    const deptSpan = document.createElement('span');
    deptSpan.className = 'balloon-dept';
    deptSpan.textContent = bp.department || '';
    deptSpan.style.fontSize = `${Math.max(8, bp.size * 0.10)}px`;

    contentDiv.appendChild(scoreSpan);
    contentDiv.appendChild(nameSpan);
    contentDiv.appendChild(deptSpan);

    // Crown for highest scorer
    const crownHtml = `
      <div class="crown-container">
        <svg viewBox="0 0 44 32" width="44" height="32" style="overflow:visible;">
          <polygon points="2,28 2,10 11,18 22,2 33,18 42,10 42,28" fill="#FFD700" stroke="#FFA500" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="2" cy="10" r="3" fill="#fff"/>
          <circle cx="22" cy="2" r="3.5" fill="#fff"/>
          <circle cx="42" cy="10" r="3" fill="#fff"/>
        </svg>
      </div>`;
    balDiv.innerHTML = crownHtml;
    balDiv.appendChild(contentDiv);

    balDiv.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      popBalloon(bp.id);
    });

    balloonsHolder.appendChild(balDiv);
  });
}

// --- Physics Engine Loop ---
let lastTime = 0;

function updatePhysics(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 16.666, 3);
  lastTime = timestamp;

  const screenW = window.innerWidth;
  const count = balloonPhysicsList.length;

  // Grid layout
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.5)));
  const colSpacing = Math.min(130, (screenW - 120) / cols);
  const gridTotalWidth = colSpacing * (cols - 1);
  // Center the grid exactly in the middle of the screen
  const gridStartX = (screenW / 2) - (gridTotalWidth / 2);

  const titleBuffer = 260;
  const rowSpacing = 180;

  // Sort by score descending
  const sortedBalloons = [...balloonPhysicsList].sort((a, b) => b.score - a.score);

  sortedBalloons.forEach((bp, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    // Symmetric zigzag stagger: alternating rows offset left/right equally
    // Even rows: shift LEFT by 0.25 slot, Odd rows: shift RIGHT by 0.25 slot
    // Net average = 0, so grid stays perfectly centered
    const staggerX = (row % 2 === 0) ? -(colSpacing * 0.25) : (colSpacing * 0.25);
    const targetAnchorX = gridStartX + (col * colSpacing) + staggerX;

    // Vertical zigzag
    const staggerY = (col % 2 === 0) ? -40 : 40;
    const targetY = titleBuffer + (row * rowSpacing) + staggerY;

    bp.targetY = targetY;
    bp.anchorY = targetY + 120;

    // Snap anchorX directly (no slow lerp causing lag)
    bp.anchorX = targetAnchorX;

    // Physics forces
    let fx = 0;
    let fy = 0;

    // Buoyancy toward target Y
    fy += (targetY - bp.y) * 0.04;

    // Spring toward anchor X (stronger snap)
    fx += (bp.anchorX - bp.x) * 0.04;

    // Gentle sway wind (symmetric, no directional bias)
    const sway = Math.sin(timestamp * 0.001 + parseInt(bp.id) * 1.3) * 0.3;
    fx += sway;

    // Micro turbulence
    fx += (Math.random() - 0.5) * 0.08;
    fy += (Math.random() - 0.5) * 0.08;

    // Apply forces with damping
    bp.vx = (bp.vx + fx) * 0.88;
    bp.vy = (bp.vy + fy) * 0.88;

    bp.x += bp.vx * dt;
    bp.y += bp.vy * dt;

    // Clamp X within screen bounds so balloons never cause horizontal overflow
    const halfSize = bp.size / 2;
    if (bp.x - halfSize < 0) { bp.x = halfSize; bp.vx *= -0.5; }
    if (bp.x + halfSize > screenW) { bp.x = screenW - halfSize; bp.vx *= -0.5; }
  });

  // Collision repulsion (prevent overlap)
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const b1 = sortedBalloons[i];
      const b2 = sortedBalloons[j];
      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (b1.size + b2.size) / 2 * 0.92;

      if (dist < minDist && dist > 0.1) {
        const overlap = (minDist - dist) * 0.12;
        const nx = dx / dist;
        const ny = dy / dist;
        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;
        b1.vx *= 0.8; b1.vy *= 0.8;
        b2.vx *= 0.8; b2.vy *= 0.8;
      }
    }
  }

  // Update DOM
  sortedBalloons.forEach(bp => {
    const domEl = document.getElementById(`bal-${bp.id}`);
    if (domEl && !domEl.classList.contains('pop-animation')) {
      const topOffset = bp.y - (bp.size * 0.5);
      const leftOffset = bp.x - (bp.size * 0.5);
      domEl.style.transform = `translate3d(${leftOffset}px, ${topOffset}px, 0)`;
      domEl.style.zIndex = Math.floor(bp.y);
    }
  });

  drawStrings(timestamp);
  requestAnimationFrame(updatePhysics);
}

// --- Render Strings on Canvas ---
function drawStrings(timestamp) {
  ctx.clearRect(0, 0, stringCanvas.width, stringCanvas.height);

  balloonPhysicsList.forEach(bp => {
    const domEl = document.getElementById(`bal-${bp.id}`);
    if (!domEl || domEl.classList.contains('pop-animation')) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const startX = bp.x;
    const startY = bp.y + bp.size * 0.5;
    const endX = startX + Math.sin(timestamp * 0.002 + parseInt(bp.id)) * 15;
    const endY = startY + 100;
    const midX = (startX + endX) / 2 + Math.cos(timestamp * 0.0015 + parseInt(bp.id)) * 10;
    const midY = (startY + endY) / 2;

    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
  });
}

// --- Pop Balloon ---
function popBalloon(id) {
  const domEl = document.getElementById(`bal-${id}`);
  if (domEl) {
    domEl.classList.add('pop-animation');
    setTimeout(() => {
      employees = employees.filter(e => e.id !== id);
      saveData();
      resizeCanvas();
      syncPhysics();
    }, 280);
  } else {
    employees = employees.filter(e => e.id !== id);
    saveData();
    resizeCanvas();
    syncPhysics();
  }
}
window.popBalloon = popBalloon;

// --- Resize Canvas ---
function resizeCanvas() {
  const count = employees.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.5)));
  const rows = Math.ceil(count / cols);

  const titleBuffer = 260;
  const rowSpacing = 180;
  const groundBuffer = 350;

  const requiredHeight = titleBuffer + (rows * rowSpacing) + groundBuffer;
  const finalHeight = Math.max(window.innerHeight, requiredHeight);

  stringCanvas.width = window.innerWidth;
  stringCanvas.height = finalHeight;

  const arena = document.querySelector('.sky-arena');
  const container = document.querySelector('.app-container');
  if (arena) arena.style.height = finalHeight + 'px';
  if (container) container.style.height = finalHeight + 'px';
}

// --- Admin & Excel Logic ---
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  const input = document.getElementById('admin-password');
  if (modal) {
    modal.classList.add('active');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 100); }
  }
}
window.openLoginModal = openLoginModal;

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
}
window.closeLoginModal = closeLoginModal;

function verifyLogin() {
  const input = document.getElementById('admin-password');
  if (input && input.value === 'admin') {
    closeLoginModal();
    openAdminModal();
  } else {
    alert('รหัสผ่านไม่ถูกต้อง (รหัสผ่านคือ: admin)');
  }
}
window.verifyLogin = verifyLogin;

function openAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.add('active');
}
window.openAdminModal = openAdminModal;

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.classList.remove('active');
}
window.closeAdminModal = closeAdminModal;

function clearAll() {
  if (confirm('ต้องการลบข้อมูลลูกโป่งทั้งหมดใช่หรือไม่?')) {
    employees = [];
    saveData();
    resizeCanvas();
    syncPhysics();
  }
}
window.clearAll = clearAll;

// --- Excel Upload ---
function setupEventListeners() {
  // Double-click title to open Admin Login (only dblclick, NOT single click)
  const mainTitle = document.querySelector('.main-title');
  if (mainTitle) {
    mainTitle.addEventListener('dblclick', openLoginModal);
  }

  // Close modals on overlay click
  ['login-modal', 'admin-modal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  });

  // Excel file upload
  const excelUpload = document.getElementById('excel-upload');
  if (excelUpload) {
    excelUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          let startIndex = 0;
          if (json.length > 0 && isNaN(parseInt(json[0][1]))) startIndex = 1;

          const departmentColors = {};
          const newEmployees = [];

          for (let i = startIndex; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length < 2) continue;
            const name = row[0] ? row[0].toString() : `พนง.${i}`;
            const score = parseInt(row[1]) || 0;
            const dept = row[2] ? row[2].toString().trim() : 'General';
            const deptKey = dept.toUpperCase();
            if (!departmentColors[deptKey]) departmentColors[deptKey] = generateVibrantColor();
            newEmployees.push({
              id: Date.now().toString() + i + Math.random(),
              name, score,
              department: dept,
              color: departmentColors[deptKey]
            });
          }

          if (newEmployees.length > 0) {
            employees = newEmployees;
            saveData();
            resizeCanvas();
            syncPhysics();
            closeAdminModal();
            alert(`อัปโหลดสำเร็จ! ${newEmployees.length} คน`);
          } else {
            alert('ไม่พบข้อมูลที่ถูกต้องในไฟล์ Excel');
          }
        } catch (err) {
          console.error(err);
          alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel');
        }
        excelUpload.value = '';
      };
      reader.readAsArrayBuffer(file);
    });
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });
}

window.addEventListener('DOMContentLoaded', init);
