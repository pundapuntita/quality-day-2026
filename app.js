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

// --- Fixed Department Colors Mapping ---
function getDepartmentColor(dept) {
  if (!dept) return generateVibrantColor();
  
  const cleanDept = dept.toString().trim().toUpperCase();
  
  switch (cleanDept) {
    case 'QA':
      return 'hsl(110, 55%, 70%)'; // Soft Pastel Green
    case 'QC':
      return 'hsl(199, 80%, 75%)'; // Soft Pastel Blue
    case 'PD ASEPTIC':
    case 'PDF':
      return 'hsl(24, 85%, 73%)';  // Soft Pastel Orange
    case 'PD PACKING':
    case 'PDP':
      return 'hsl(53, 90%, 68%)';  // Soft Pastel Yellow
    case 'MM':
      return 'hsl(288, 65%, 73%)'; // Soft Pastel Purple
    case 'E&M':
    case 'E & M':
    case 'EM':
      return 'hsl(328, 85%, 78%)'; // Soft Pastel Pink
    case 'RA':
    case 'HR':
    case 'HR&SS':
    case 'HSE':
    case 'FA':
    case 'TRAINEE':
      return 'hsl(5, 90%, 72%)';   // Soft Pastel Red
    default:
      return generateVibrantColor();
  }
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

// --- Fetch Shared Excel File via Vercel Serverless Function Proxy ---
function fetchSharedExcel() {
  fetch('/api/sheet')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch from proxy API');
      }
      return response.arrayBuffer();
    })
    .then(buffer => {
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const newEmployees = parseExcelJSON(json);
      if (newEmployees.length > 0) {
        employees = newEmployees;
        saveData();
        resizeCanvas();
        syncPhysics();
        console.log('Loaded shared data from Google Sheets successfully via Vercel proxy.');
      }
    })
    .catch(err => {
      console.log('No shared data auto-loaded:', err.message);
    });
}

// --- Initialize App ---
function init() {
  loadData();
  resizeCanvas();
  syncPhysics();
  setupEventListeners();
  requestAnimationFrame(updatePhysics);
  
  // Try to load shared data if it exists in the repo
  fetchSharedExcel();
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
  let minSize = 70;
  let maxSize = 140;

  const screenW = window.innerWidth;
  if (screenW < 480) { // Mobile
    minSize = 42;
    maxSize = 78;
  } else if (screenW < 1024) { // Tablet
    minSize = 55;
    maxSize = 110;
  }

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

  // Responsive Grid Layout
  let colSpacing = 120;
  let rowSpacing = 180;
  let titleBuffer = 260;

  if (screenW < 480) { // Mobile
    colSpacing = 65;
    rowSpacing = 100;
    titleBuffer = 160;
  } else if (screenW < 1024) { // Tablet
    colSpacing = 90;
    rowSpacing = 140;
    titleBuffer = 210;
  }

  // Calculate maximum columns that can fit
  const maxCols = Math.max(1, Math.floor((screenW - 40) / colSpacing));
  const cols = Math.min(maxCols, count || 1);

  const gridTotalWidth = colSpacing * (cols - 1);
  const gridStartX = (screenW / 2) - (gridTotalWidth / 2);

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
    const staggerY = (col % 2 === 0) ? -20 : 20; // Reduced vertical zigzag on smaller screen
    const targetY = titleBuffer + (row * rowSpacing) + (screenW < 480 ? staggerY * 0.4 : (screenW < 1024 ? staggerY * 0.7 : staggerY));

    bp.targetY = targetY;
    bp.anchorY = targetY + (screenW < 480 ? 60 : (screenW < 1024 ? 90 : 120));

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
    const endY = startY + (bp.size * 0.9); // Dynamic string length based on balloon size
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
  const screenW = window.innerWidth;
  
  let colSpacing = 120;
  let rowSpacing = 180;
  let titleBuffer = 260;
  let groundBuffer = 350;

  if (screenW < 480) { // Mobile
    colSpacing = 65;
    rowSpacing = 100;
    titleBuffer = 160;
    groundBuffer = 180;
  } else if (screenW < 1024) { // Tablet
    colSpacing = 90;
    rowSpacing = 140;
    titleBuffer = 210;
    groundBuffer = 250;
  }

  const maxCols = Math.max(1, Math.floor((screenW - 40) / colSpacing));
  const cols = Math.min(maxCols, count || 1);
  const rows = Math.ceil(count / cols);

  const requiredHeight = titleBuffer + (rows * rowSpacing) + groundBuffer;
  const finalHeight = Math.max(window.innerHeight, requiredHeight);

  stringCanvas.width = window.innerWidth;
  stringCanvas.height = finalHeight;

  const arena = document.querySelector('.sky-arena');
  const container = document.querySelector('.app-container');
  if (arena) arena.style.height = finalHeight + 'px';
  if (container) container.style.height = finalHeight + 'px';

  // Re-calculate balloon sizes and update their element sizes/fonts
  balloonPhysicsList.forEach(bp => {
    bp.size = calculateBalloonSize(bp.score);
    const domEl = document.getElementById(`bal-${bp.id}`);
    if (domEl) {
      domEl.style.width = `${bp.size}px`;
      domEl.style.height = `${bp.size}px`;
      
      const scoreSpan = domEl.querySelector('.balloon-score');
      if (scoreSpan) scoreSpan.style.fontSize = `${Math.max(12, bp.size * 0.22)}px`;
      
      const nameSpan = domEl.querySelector('.balloon-name');
      if (nameSpan) nameSpan.style.fontSize = `${Math.max(10, bp.size * 0.12)}px`;
      
      const deptSpan = domEl.querySelector('.balloon-dept');
      if (deptSpan) deptSpan.style.fontSize = `${Math.max(8, bp.size * 0.10)}px`;
    }
  });
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

// --- Parse Excel JSON to Employee List ---
function parseExcelJSON(json) {
  let nameIdx = 0;
  let scoreIdx = 1;
  let deptIdx = -1;
  let startIndex = 0;

  if (json.length > 0) {
    const firstRow = json[0] || [];
    let foundHeader = false;
    
    for (let col = 0; col < firstRow.length; col++) {
      const cellText = firstRow[col] ? firstRow[col].toString().toLowerCase().trim() : '';
      if (
        cellText.includes('name') || cellText.includes('ชื่อ') ||
        cellText.includes('score') || cellText.includes('คะแนน') || cellText.includes('point') || cellText.includes('qp') ||
        cellText.includes('dept') || cellText.includes('แผนก') || cellText.includes('department')
      ) {
        foundHeader = true;
        break;
      }
    }

    if (foundHeader) {
      startIndex = 1;
      let detectedNameIdx = -1;
      let detectedScoreIdx = -1;
      let detectedDeptIdx = -1;

      for (let col = 0; col < firstRow.length; col++) {
        const headerText = firstRow[col] ? firstRow[col].toString().toLowerCase().trim() : '';
        if (headerText.includes('name') || headerText.includes('ชื่อ')) {
          detectedNameIdx = col;
        } else if (headerText.includes('score') || headerText.includes('คะแนน') || headerText.includes('point') || headerText.includes('qp')) {
          detectedScoreIdx = col;
        } else if (headerText.includes('dept') || headerText.includes('แผนก') || headerText.includes('department')) {
          detectedDeptIdx = col;
        }
      }

      if (detectedNameIdx !== -1) nameIdx = detectedNameIdx;
      if (detectedScoreIdx !== -1) scoreIdx = detectedScoreIdx;
      if (detectedDeptIdx !== -1) deptIdx = detectedDeptIdx;
    }
  }

  if (deptIdx === -1 && json[0] && json[0].length > 2) {
    if (nameIdx !== 2 && scoreIdx !== 2) {
      deptIdx = 2;
    }
  }

  const newEmployees = [];

  for (let i = startIndex; i < json.length; i++) {
    const row = json[i];
    if (!row || row.length === 0) continue;
    
    const name = (nameIdx < row.length && row[nameIdx] !== undefined) ? row[nameIdx].toString().trim() : '';
    if (!name) continue; // Skip blank names
    
    let score = 0;
    if (scoreIdx < row.length && row[scoreIdx] !== undefined && row[scoreIdx] !== null) {
      score = parseInt(row[scoreIdx]) || 0;
    }
    
    let dept = 'General';
    if (deptIdx !== -1 && deptIdx < row.length && row[deptIdx] !== undefined && row[deptIdx] !== null) {
      dept = row[deptIdx].toString().trim();
    }
    
    newEmployees.push({
      id: Date.now().toString() + i + Math.random(),
      name, 
      score,
      department: dept,
      color: getDepartmentColor(dept)
    });
  }

  return newEmployees;
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  // Click or Double-click title to open Admin Login
  const mainTitle = document.querySelector('.main-title');
  if (mainTitle) {
    mainTitle.addEventListener('dblclick', openLoginModal);
    mainTitle.addEventListener('click', openLoginModal);
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

          const newEmployees = parseExcelJSON(json);

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
