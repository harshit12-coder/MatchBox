/**
 * Matchbox — Carton Barcode Validator
 * Core Application Logic
 */

(function () {
  "use strict";

  // ─── DOM References ────────────────────────
  const cartonInput = document.getElementById("cartonBarcodeInput");
  const labelInput = document.getElementById("labelBarcodeInput");
  const validateBtn = document.getElementById("validateBtn");
  const resultPanel = document.getElementById("resultPanel");
  const resultIconContainer = document.getElementById("resultIconContainer");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");

  const scanCard1 = document.getElementById("scanCard1");
  const scanCard2 = document.getElementById("scanCard2");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultOverlayContent = document.getElementById("resultOverlayContent");
  const toastContainer = document.getElementById("toastContainer");

  // Scanner DOM
  const scanCartonBtn = document.getElementById("scanCartonBtn");
  const scanLabelBtn = document.getElementById("scanLabelBtn");
  const scannerModal = document.getElementById("scannerModal");
  const scannerModalTitle = document.getElementById("scannerModalTitle");
  const scannerCloseBtn = document.getElementById("scannerCloseBtn");
  const scannerVideo = document.getElementById("scannerVideo");
  const scannerCanvas = document.getElementById("scannerCanvas");
  const scannerHintText = document.getElementById("scannerHintText");

  // Nav DOM
  const navSettingsBtn = document.getElementById("navSettingsBtn");
  const navHomeBtn = document.getElementById("navHomeBtn");
  const navAdminBtn = document.getElementById("navAdminBtn");
  const navLogoutBtn = document.getElementById("navLogoutBtn");

  // Settings DOM
  const settingsModal = document.getElementById("settingsModal");
  const settingsCloseBtn = document.getElementById("settingsCloseBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const syncStatus = document.getElementById("syncStatus");
  const smartScanBtn = document.getElementById("smartScanBtn");
  const logoGroup = document.querySelector(".logo-group");
  const loginOverlay = document.getElementById("loginOverlay");
  const loginUsernameInput = document.getElementById("loginUsername");
  const loginPasswordInput = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  // Stats
  const statTotal = document.getElementById("statTotal");
  const statPass = document.getElementById("statPass");
  const statFail = document.getElementById("statFail");

  // Admin View DOM
  const homeView = document.getElementById("homeView");
  const adminView = document.getElementById("adminView");
  const adminAddUserBtn = document.getElementById("adminAddUserBtn");
  const adminScanTableBody = document.getElementById("adminScanTableBody");
  const filterAdminResult = document.getElementById("filterAdminResult");
  const adminExportBtn = document.getElementById("adminExportBtn");

  const adminStatTotal = document.getElementById("adminStatTotal");
  const adminStatAccuracy = document.getElementById("adminStatAccuracy");
  const adminStatUsers = document.getElementById("adminStatUsers");

  // ─── Supabase Configuration ────────────────
  const SUPABASE_URL = "https://sfndxujqzdybmquoqxmj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_5zenHgExDRDkr6o20UVgOg_4mt7bV2z";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ─── Scanner State ─────────────────────────
  let currentScanTarget = null;
  let cameraStream = null;
  let scanAnimFrame = null;
  let barcodeDetector = null;
  let scannerActive = false;
  let lastScanTime = 0;
  let isSmartScanMode = false;

  // ─── State ─────────────────────────────────
  let history = JSON.parse(localStorage.getItem("matchbox_history") || "[]");
  let stats = JSON.parse(
    localStorage.getItem("matchbox_stats") ||
      '{"total":0,"pass":0,"fail":0}'
  );
  let currentUser = localStorage.getItem("matchbox_operator") || "";
  let currentUserRole = localStorage.getItem("matchbox_operator_role") || "";
  let currentUserFullName = localStorage.getItem("matchbox_operator_name") || "";
  let authMode = "login"; // "login" or "signup"

  // ─── Sound Engine ───────────────────────────
  const SoundEngine = {
    ctx: null,
    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    play(freq, type, duration, vol) {
      try {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        console.warn("Audio play failed:", e);
      }
    },
    scan() { this.play(880, 'sine', 0.1, 0.1); },
    success() {
      this.play(660, 'sine', 0.2, 0.1);
      setTimeout(() => this.play(880, 'sine', 0.3, 0.1), 100);
    },
    error() {
      this.play(150, 'sawtooth', 0.4, 0.1);
      this.play(110, 'sawtooth', 0.4, 0.1);
    },
    click() { this.play(440, 'triangle', 0.05, 0.05); }
  };

  // ─── Init ──────────────────────────────────
  function init() {
    // Show login if not logged in
    if (currentUser) {
      loginOverlay.style.display = "none";
      updateAdminButton(); 
      // Ensure focus on carton barcode when app opens
      setTimeout(() => {
        if (cartonInput && homeView.style.display !== "none") {
          cartonInput.focus();
        }
      }, 500);
    }

    renderStats();
    renderHistory();
    setupListeners();

    if (window.particlesJS && document.getElementById('particles-js')) {
      particlesJS("particles-js", {
        "particles": {
          "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
          "color": { "value": "#6366f1" },
          "shape": { "type": "circle" },
          "opacity": { "value": 0.5, "random": false },
          "size": { "value": 3, "random": true },
          "line_linked": { "enable": true, "distance": 150, "color": "#8b5cf6", "opacity": 0.3, "width": 1 },
          "move": { "enable": true, "speed": 1.5, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
          "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 1 } }, "push": { "particles_nb": 4 } }
        },
        "retina_detect": true
      });
    }

    registerServiceWorker();
    initBarcodeDetector();
    setupScannerAutoDiscovery();
  }

  // ─── Hardware Scanner Auto-Focus Logic ──────
  function setupScannerAutoDiscovery() {
    // Continuously check if focus is lost and recover it to the first empty field
    document.addEventListener("keydown", (e) => {
      // Ignore if user is inside a modal or settings
      if (!settingsModal.classList.contains("hidden") || 
          !scannerModal.classList.contains("hidden") ||
          loginOverlay.style.display === "flex") return;

      const active = document.activeElement;
      const isInput = active.tagName === "INPUT" || active.tagName === "SELECT";
      
      // If no input is focused, redirect to our scan inputs
      if (!isInput) {
        if (!cartonInput.value.trim()) {
          cartonInput.focus();
        } else if (!labelInput.value.trim()) {
          labelInput.focus();
        }
      }
    });

    // Auto-focus carton on page load or when coming back from settings
    window.addEventListener("focus", () => {
        if (!cartonInput.value.trim() && homeView.style.display !== "none") {
            cartonInput.focus();
        }
    });

    // Also focus when switching back to home view
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "style") {
                if (homeView.style.display !== "none") {
                    if (!cartonInput.value.trim()) {
                        cartonInput.focus();
                    }
                }
            }
        });
    });
    observer.observe(homeView, { attributes: true });
  }

  // Handle browser back-forward cache/navigation
  window.addEventListener("pageshow", updateAdminButton);

  function updateAdminButton() {
    const freshUser = localStorage.getItem("matchbox_operator");
    const freshRole = (localStorage.getItem("matchbox_operator_role") || "").toLowerCase();
    
    // Safety check: if user exists in storage but overlay is still visible
    if (freshUser && loginOverlay) {
      loginOverlay.style.display = "none";
    }

    if (navAdminBtn) {
      if (freshRole === "admin") {
        navAdminBtn.classList.remove("hidden");
        navAdminBtn.style.display = "flex";
      } else {
        navAdminBtn.classList.add("hidden");
        navAdminBtn.style.display = "none";
      }
    }
  }

  // Backup check every 3 seconds to ensure UI consistency
  setInterval(updateAdminButton, 3000);
  
  // Immediate check on script load
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "interactive") updateAdminButton();
  });
  async function initBarcodeDetector() {
    if ("BarcodeDetector" in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        barcodeDetector = new BarcodeDetector({ formats });
        console.log("BarcodeDetector ready with formats:", formats);
      } catch (e) {
        console.warn("BarcodeDetector init failed:", e);
        barcodeDetector = null;
      }
    } else {
      console.warn("BarcodeDetector API not supported — manual entry only");
    }
  }

  // ─── Service Worker Registration ───────────
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }

  // ─── Listeners ─────────────────────────────
  function setupListeners() {
    // Resume AudioContext on first user interaction
    document.addEventListener('click', () => SoundEngine.init(), { once: true });
    document.addEventListener('touchstart', () => SoundEngine.init(), { once: true });

    // Background focus grabber: if user clicks background, focus the current input
    document.addEventListener("click", (e) => {
      if (e.target === document.body || e.target.classList.contains("main-content") || e.target.classList.contains("app-container")) {
        if (!cartonInput.value.trim()) {
          cartonInput.focus();
        } else if (!labelInput.value.trim()) {
          labelInput.focus();
        }
      }
    });

    cartonInput.addEventListener("focus", () => {
      scanCard1.classList.add("active");
      scanCard2.classList.remove("active");
    });
    cartonInput.addEventListener("blur", () => {
      scanCard1.classList.remove("active");
    });
    labelInput.addEventListener("focus", () => {
      scanCard2.classList.add("active");
      scanCard1.classList.remove("active");
    });
    labelInput.addEventListener("blur", () => {
      scanCard2.classList.remove("active");
    });

    cartonInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const val = cartonInput.value.trim();
        if (val) {
          scanCard1.classList.add("done");
          labelInput.focus();
          hapticFeedback("light");
          // Play a quick beep for hardware scan success
          SoundEngine.scan(); 
        }
      }
    });

    labelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const val = labelInput.value.trim();
        if (val) {
          scanCard2.classList.add("done");
          hapticFeedback("light");
          performValidation();
        }
      }
    });

    cartonInput.addEventListener("input", () => {
      const val = cartonInput.value.trim();
      if (val) {
        scanCard1.classList.add("done");
        
        // Auto-transition to label if format matches (for hardware scanners without Enter suffix)
        const companyRegex = /^([A-Z]{2}(U1|U3|1P|3P|LT)(WO|WB)[0-9][0-9][A-Z]\d{5,6})$/;
        if (companyRegex.test(val)) {
            labelInput.focus();
            SoundEngine.scan(); // Play scan sound for magic transition
        }
      } else {
        scanCard1.classList.remove("done");
      }
    });

    labelInput.addEventListener("input", () => {
      const val = labelInput.value.trim();
      if (val) {
        scanCard2.classList.add("done");

        // Auto-validate if format matches and carton is present
        const companyRegex = /^([A-Z]{2}(U1|U3|1P|3P|LT)(WO|WB)[0-9][0-9][A-Z]\d{5,6})$/;
        if (companyRegex.test(val) && cartonInput.value.trim()) {
            performValidation();
        }
      } else {
        scanCard2.classList.remove("done");
      }
    });

    validateBtn.addEventListener("click", performValidation);

    scanCartonBtn.addEventListener("click", () => {
      resetForm();
      isSmartScanMode = false;
      openScanner("carton");
    });
    scanLabelBtn.addEventListener("click", () => {
      isSmartScanMode = false;
      openScanner("label");
    });
    smartScanBtn.addEventListener("click", () => {
      resetForm();
      isSmartScanMode = true;
      openScanner("carton");
    });
    scannerCloseBtn.addEventListener("click", closeScanner);

    clearHistoryBtn.addEventListener("click", () => {
      history = [];
      stats = { total: 0, pass: 0, fail: 0 };
      saveState();
      renderHistory();
      renderStats();
      showToast("History cleared", "success");
    });

    // Navigation Helper
    function switchNav(activeBtn) {
      [navHomeBtn, navSettingsBtn, navAdminBtn].forEach(btn => {
        if(btn) btn.classList.remove("active");
      });
      if(activeBtn) activeBtn.classList.add("active");
    }

    navSettingsBtn.addEventListener("click", () => {
      const isHidden = settingsModal.classList.contains("hidden");
      if (isHidden) {
        settingsModal.classList.remove("hidden");
        switchNav(navSettingsBtn);
      } else {
        settingsModal.classList.add("hidden");
        // Check which view is currently active
        if (adminView.style.display === "flex" || adminView.style.display === "block") {
            switchNav(navAdminBtn);
        } else {
            switchNav(navHomeBtn);
        }
      }
    });

    navHomeBtn.addEventListener("click", () => {
      settingsModal.classList.add("hidden");
      homeView.style.display = "flex";
      adminView.style.display = "none";
      switchNav(navHomeBtn);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    logoGroup.style.cursor = "pointer";
    logoGroup.addEventListener("click", () => {
      settingsModal.classList.remove("hidden");
      switchNav(navSettingsBtn);
    });

    settingsCloseBtn.addEventListener("click", () => {
      settingsModal.classList.add("hidden");
      switchNav(navHomeBtn);
    });

    saveSettingsBtn.addEventListener("click", () => {
      showToast("Cloud connection active", "success");
      settingsModal.classList.add("hidden");
      switchNav(navHomeBtn);
    });

    // New Auth DOM References
    // Authentication Mode initialized
    authMode = "login";

    // Login/Signup Logic
    loginBtn.addEventListener("click", handleAuth);
    loginPasswordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleAuth();
    });

    // View Data (Admin Only)
    navAdminBtn.addEventListener("click", () => {
      homeView.style.display = "none";
      adminView.style.display = "block";
      settingsModal.classList.add("hidden");
      switchNav(navAdminBtn);
      
      // Load and refresh admin data
      fetchAdminStats();
      fetchAdminScans();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    adminAddUserBtn.addEventListener("click", adminAddUser);
    adminExportBtn.addEventListener("click", exportCSV);
    
    // Global function for filter change
    window.fetchAdminScans = fetchAdminScans;
    window.exportCSV = exportCSV;

    // Logout Logic (from settings modal)
    navLogoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        currentUser = "";
        currentUserRole = "";
        localStorage.removeItem("matchbox_operator");
        localStorage.removeItem("matchbox_operator_role");
        updateAdminButton();
        settingsModal.classList.add("hidden");
        loginOverlay.style.display = "flex";
        loginUsernameInput.value = "";
        loginPasswordInput.value = "";
        showToast("Logged out successfully", "success");
      }
    });
  }

  async function handleAuth() {
    const email = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
        showToast("Please fill all required fields", "warning");
        return;
    }

    loginBtn.innerHTML = "<span>Authenticating...</span>";
    loginBtn.disabled = true;
    loginError.style.display = "none";

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      // 2. Fetch User Profile for Role and Name
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // 3. Set Session State
      currentUser = profileData.email;
      currentUserFullName = profileData.full_name || profileData.username;
      currentUserRole = (profileData.role || "user").toLowerCase();

      localStorage.setItem("matchbox_operator", currentUser);
      localStorage.setItem("matchbox_operator_name", currentUserFullName);
      localStorage.setItem("matchbox_operator_role", currentUserRole);

      showToast(`Welcome, ${currentUserFullName}!`, "success");
      loginOverlay.style.display = "none";
      updateAdminButton();
      
      // Focus carton barcode after login
      setTimeout(() => {
        if (cartonInput) cartonInput.focus();
      }, 300);

    } catch (error) {
      console.error("Auth error:", error);
      loginError.innerText = error.message || "Authentication failed";
      loginError.style.display = "block";
    } finally {
      loginBtn.innerHTML = "<span>Login</span>";
      loginBtn.disabled = false;
    }
  }

  // ─── Camera Scanner ─────────────────────────
  async function openScanner(target) {
    // 1. Check for Secure Context (Required for Camera)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isSecure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (!isSecure) {
        showToast("🚨 CAMERA ACCESS BLOCKED: Browsers require HTTPS or Localhost to use the camera. Please access via HTTPS or from the Server PC directly.", "error");
      } else {
        showToast("⚠️ Camera hardware not detected or restricted by system settings.", "error");
      }
      return;
    }

    currentScanTarget = target;
    scannerModalTitle.textContent =
      target === "carton" ? "Scan Carton Barcode" : "Scan Label Barcode";

    scannerModal.classList.remove("hidden");
    scannerHintText.textContent = "Starting camera…";
    scannerActive = true;

    // Check if BarcodeDetector is available
    if (!barcodeDetector) {
      await initBarcodeDetector();
    }

    try {
      // Request camera with preference for back camera
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      scannerVideo.srcObject = cameraStream;
      scannerVideo.setAttribute("playsinline", true);

      await scannerVideo.play();

      if (barcodeDetector) {
        scannerHintText.textContent = "Point camera at barcode to scan";
        startDetectionLoop();
      } else {
        // Fallback: show message, user can type manually
        scannerHintText.innerHTML =
          "⚠️ Auto-detection unavailable in this browser.<br>Use manual entry below.";
        showManualFallback();
      }
    } catch (err) {
      console.error("Camera error:", err);
      scannerActive = false;

      let msg = "Camera not available.";
      if (err.name === "NotAllowedError") {
        msg = "Camera permission denied. Please allow camera access.";
      } else if (err.name === "NotFoundError") {
        msg = "No camera found on this device.";
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        msg = "Camera requires HTTPS. Please use a secure connection.";
      }

      showToast(msg, "error");
      closeScanner();
    }
  }

  function startDetectionLoop() {
    if (!scannerActive) return;

    scanAnimFrame = requestAnimationFrame(async () => {
      if (!scannerActive || !scannerVideo || scannerVideo.readyState < 2) {
        startDetectionLoop();
        return;
      }

      const now = Date.now();
      // Throttle to ~10fps for detection
      if (now - lastScanTime < 100) {
        startDetectionLoop();
        return;
      }
      lastScanTime = now;

      try {
        const barcodes = await barcodeDetector.detect(scannerVideo);
        if (barcodes.length > 0 && scannerActive) {
          const result = barcodes[0].rawValue;
          onScanSuccess(result);
          return; // Stop loop after success
        }
      } catch (e) {
        // Detection errors are normal (e.g., no barcode in frame)
      }

      if (scannerActive) {
        startDetectionLoop();
      }
    });
  }

  function showManualFallback() {
    // Add a manual input inside the scanner modal
    const existing = document.getElementById("scannerManualInput");
    if (existing) return;

    const wrapper = document.createElement("div");
    wrapper.id = "scannerManualWrapper";
    wrapper.style.cssText = `
      padding: 16px 20px;
      display: flex;
      gap: 10px;
      background: rgba(10,14,26,0.9);
      border-top: 1px solid rgba(255,255,255,0.06);
    `;
    wrapper.innerHTML = `
      <input id="scannerManualInput" type="text" placeholder="Type barcode manually…"
        style="flex:1;padding:12px 16px;background:rgba(15,23,42,0.9);border:1.5px solid rgba(255,255,255,0.1);
        border-radius:10px;font-size:0.9rem;color:#f1f5f9;outline:none;font-family:inherit;" 
        autocomplete="off" inputmode="text" />
      <button id="scannerManualSubmit"
        style="padding:12px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;
        border-radius:10px;color:white;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;">
        OK
      </button>
    `;
    scannerModal.appendChild(wrapper);

    const manualInput = document.getElementById("scannerManualInput");
    const manualSubmit = document.getElementById("scannerManualSubmit");

    const submit = () => {
      const val = manualInput.value.trim();
      if (val) {
        onScanSuccess(val);
      } else {
        manualInput.style.borderColor = "#ef4444";
        setTimeout(() => (manualInput.style.borderColor = ""), 1000);
      }
    };

    manualSubmit.addEventListener("click", submit);
    manualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    setTimeout(() => manualInput.focus(), 100);
  }

  function onScanSuccess(decodedText) {
    if (!scannerActive) return;

    const savedTarget = currentScanTarget;

    if (savedTarget === "carton") {
      cartonInput.value = decodedText;
      scanCard1.classList.add("done");
    } else {
      labelInput.value = decodedText;
      scanCard2.classList.add("done");
    }

    // Trigger Laser Pulse Success Animation
    const laser = document.querySelector(".scanner-laser");
    if (laser) {
      laser.classList.remove("pulse-success");
      void laser.offsetWidth; // Force reflow
      laser.classList.add("pulse-success");
    }

    SoundEngine.scan(); // Play scan sound
    hapticFeedback("success");
    showToast(`Scanned: ${decodedText.substring(0, 30)}`, "success");

    if (isSmartScanMode && savedTarget === "carton") {
      // Smart Scan Move to Phase 2: Label
      labelInput.value = ""; // Ensure label is empty for phase 2
      scannerHintText.textContent = "WAITING...";
      
      setTimeout(() => {
        if (!scannerActive) return;
        currentScanTarget = "label";
        scannerModalTitle.textContent = "STEP 2: SCAN LABEL";
        scannerHintText.textContent = "NOW SCAN THE LABEL BARCODE";
        hapticFeedback("success");
        
        // Visual flash to signal transition
        const viewfinder = document.querySelector(".scanner-viewfinder");
        if (viewfinder) {
          viewfinder.style.border = "4px solid var(--accent-secondary)";
          setTimeout(() => viewfinder.style.border = "", 500);
        }
        
        // Re-start detection loop after user has had time to move
        startDetectionLoop();
      }, 1200); // Increased delay to 1.2s to allow camera movement
    } else {
      // Normal scan or end of smart scan
      closeScanner();

      setTimeout(() => {
        if (savedTarget === "carton") {
          // If we scanned a new carton, we MUST clear the old label to avoid false matches
          if (!isSmartScanMode) labelInput.value = ""; 
          
          if (!labelInput.value.trim()) {
            labelInput.focus();
          } else {
            // Both are full, auto-validate
            performValidation();
          }
        } else {
          // Just scanned a label
          if (cartonInput.value.trim()) {
            performValidation();
          } else {
            cartonInput.focus();
            showToast("Now scan the carton barcode", "info");
          }
        }
      }, 300);
    }
  }

  function closeScanner() {
    scannerActive = false;

    if (scanAnimFrame) {
      cancelAnimationFrame(scanAnimFrame);
      scanAnimFrame = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    if (scannerVideo) {
      scannerVideo.srcObject = null;
    }

    // Remove manual fallback wrapper if present
    const manualWrapper = document.getElementById("scannerManualWrapper");
    if (manualWrapper) manualWrapper.remove();

    scannerModal.classList.add("hidden");
  }

  // ─── Validation ────────────────────────────
  function performValidation() {
    const cartonValue = cartonInput.value.trim();
    const labelValue = labelInput.value.trim();

    if (!cartonValue && !labelValue) {
      showToast("Please scan both barcodes before validating", "warning");
      cartonInput.focus();
      shakeElement(scanCard1);
      return;
    }
    if (!cartonValue) {
      showToast("Carton barcode is missing", "warning");
      cartonInput.focus();
      shakeElement(scanCard1);
      return;
    }
    if (!labelValue) {
      showToast("Label barcode is missing", "warning");
      labelInput.focus();
      shakeElement(scanCard2);
      return;
    }

    // Regex Validation for Company Format
    // Format: ^([A-Z]{2}(U1|U3|1P|3P|LT)(WO|WB)[0-9][0-9][A-Z]\d{5,6})$
    const companyRegex = /^([A-Z]{2}(U1|U3|1P|3P|LT)(WO|WB)[0-9][0-9][A-Z]\d{5,6})$/;
    
    if (!companyRegex.test(cartonValue)) {
      showToast("Invalid Carton Format!", "warning");
      shakeElement(scanCard1);
      return;
    }
    
    if (!companyRegex.test(labelValue)) {
      showToast("Invalid Label Format!", "warning");
      shakeElement(scanCard2);
      return;
    }

    // Logic: Exact match OR the label QR contains the carton barcode value
    const isMatch =
      cartonValue === labelValue ||
      (cartonValue.length >= 3 && labelValue.includes(cartonValue));

    stats.total++;
    if (isMatch) {
      stats.pass++;
    } else {
      stats.fail++;
    }

    const record = {
      carton: cartonValue,
      label: labelValue,
      match: isMatch,
      timestamp: new Date().toISOString(),
    };
    history.unshift(record);
    if (history.length > 50) history.pop();

    saveState();
    renderStats();
    renderHistory();
    showResult(isMatch, cartonValue, labelValue);
    showOverlay(isMatch);
    
    if (isMatch) {
      SoundEngine.success();
    } else {
      SoundEngine.error();
    }

    hapticFeedback(isMatch ? "success" : "error");

    // Sync to server
    if (serverUrl) {
      sendScanToServer(record);
    }

    // Auto-reset form after a delay so user can see result
    setTimeout(
      () => {
        resetForm();
      },
      isMatch ? 1500 : 2500 // Faster reset for match
    );
  }

  // ─── Show Result Panel ─────────────────────
  function showResult(isMatch, carton, label) {
    resultPanel.classList.remove("hidden", "success", "error");
    resultPanel.classList.add(isMatch ? "success" : "error");

    if (isMatch) {
      resultIconContainer.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;
      resultTitle.textContent = "Validation Passed ✓";
      resultMessage.textContent = `Both barcodes match: "${truncate(carton, 30)}"`;
    } else {
      resultIconContainer.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;
      resultTitle.textContent = "Validation Failed ✗";
      resultMessage.textContent = `Carton: "${truncate(carton, 20)}" ≠ Label: "${truncate(label, 20)}"`;
    }
  }

  // ─── Show Overlay ──────────────────────────
  function showOverlay(isMatch) {
    resultOverlay.classList.remove("hidden", "success-active", "error-active");
    resultOverlay.classList.add(isMatch ? "success-active" : "error-active");
    
    resultOverlayContent.innerHTML = `
      <div class="overlay-icon ${isMatch ? "success-icon" : "error-icon"}">
        ${
          isMatch
            ? `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>`
            : `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>`
        }
      </div>
      <div class="overlay-text ${isMatch ? "success-text" : "error-text"}">
        ${isMatch ? "MATCH!" : "MISMATCH!"}
      </div>
    `;

    if (isMatch) spawnConfetti();

    setTimeout(
      () => {
        resultOverlayContent.style.animation = "overlayFadeOut 0.3s ease forwards";
        resultOverlayContent.style.animation = "overlayFadeOut 0.3s ease forwards";
        setTimeout(() => {
          resultOverlay.classList.add("hidden");
          resultOverlay.classList.remove("success-active", "error-active");
          resultOverlayContent.style.animation = "";
        }, 300);
      },
      isMatch ? 1500 : 2500
    );
  }

  // ─── Confetti ──────────────────────────────
  function spawnConfetti() {
    const colors = ["#00ff9d","#34d399","#6ee7b7","#a5b4fc","#818cf8","#fbbf24","#f472b6"];
    for (let i = 0; i < 30; i++) {
      const conf = document.createElement("div");
      conf.className = "confetti";
      conf.style.left = `${Math.random() * 100}%`;
      conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      conf.style.animation = `confettiFall ${1.5 + Math.random() * 2}s linear forwards`;
      conf.style.animationDelay = `${Math.random() * 0.5}s`;
      conf.style.width = `${6 + Math.random() * 6}px`;
      conf.style.height = `${6 + Math.random() * 6}px`;
      document.body.appendChild(conf);
      setTimeout(() => conf.remove(), 4000);
    }
  }

  // ─── Reset Form ────────────────────────────
  function resetForm() {
    cartonInput.value = "";
    labelInput.value = "";
    resultPanel.classList.add("hidden");
    resultPanel.classList.remove("success", "error");
    scanCard1.classList.remove("done");
    scanCard2.classList.remove("done");
    cartonInput.focus();
  }

  // ─── Render Stats ──────────────────────────
  function renderStats() {
    animateNumber(statTotal, stats.total);
    animateNumber(statPass, stats.pass);
    animateNumber(statFail, stats.fail);
  }

  function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const duration = 400;
    const start = performance.now();
    function step(timestamp) {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(current + (target - current) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Render History ────────────────────────
  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = "";
      historyEmpty.classList.remove("hidden");
      return;
    }

    historyEmpty.classList.add("hidden");
    historyList.innerHTML = history
      .slice(0, 10)
      .map((item, i) => {
        const time = new Date(item.timestamp);
        const timeStr = time.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const statusClass = item.match ? "pass" : "fail";
        const statusIcon = item.match
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        return `
          <div class="history-item ${statusClass}" style="animation-delay: ${i * 0.05}s">
            <div class="history-item-status ${statusClass}">${statusIcon}</div>
            <div class="history-item-info">
              <div class="history-barcode-row">
                <span class="barcode-label">Carton:</span>
                <span class="barcode-value">${escapeHtml(truncate(item.carton, 20))}</span>
              </div>
              <div class="history-barcode-row">
                <span class="barcode-label">Label:</span>
                <span class="barcode-value">${escapeHtml(truncate(item.label, 20))}</span>
              </div>
              <div class="history-item-time">${timeStr}</div>
            </div>
            <div class="history-item-badge ${statusClass}">
              ${item.match ? "PASS" : "FAIL"}
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ─── Persist State ─────────────────────────
  function saveState() {
    localStorage.setItem("matchbox_history", JSON.stringify(history));
    localStorage.setItem("matchbox_stats", JSON.stringify(stats));
  }

  // ─── Server Sync ───────────────────────────
  async function sendScanToServer(record) {
    try {
      const { error } = await supabase
        .from('scans')
        .insert([{
          carton_barcode: record.carton,
          label_barcode: record.label,
          result: record.match ? "MATCH" : "MISMATCH",
          scanned_by: currentUserFullName || currentUser || "Unknown Operator"
        }]);

      if (error) throw error;
      console.log("Scan synced to Supabase");
    } catch (err) {
      console.error("Supabase sync error:", err.message);
    }
  }

  // ─── Toast ─────────────────────────────────
  function showToast(message, type = "warning") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const iconMap = {
      warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    };
    toast.innerHTML = `${iconMap[type] || ""}<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("exiting");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── Haptic ────────────────────────────────
  function hapticFeedback(type = "light") {
    if ("vibrate" in navigator) {
      switch (type) {
        case "success": navigator.vibrate([50, 50, 50]); break;
        case "error": navigator.vibrate([100, 50, 100, 50, 100]); break;
        default: navigator.vibrate(30);
      }
    }
  }

  // ─── Shake ─────────────────────────────────
  function shakeElement(el) {
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 400);
  }

  // ─── Utility ───────────────────────────────
  function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + "…" : str;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Admin Dashboard Logic ──────────────────
  async function fetchAdminStats() {
    try {
        // 1. Total Scans
        const { count: total, error: e1 } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true });
        
        // 2. Accuracy (Match Count)
        const { count: matches, error: e2 } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true })
            .eq('result', 'MATCH');

        // 3. Staff Count
        const { count: userCount, error: e3 } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (e1 || e2 || e3) throw (e1 || e2 || e3);

        animateNumber(adminStatTotal, total || 0);
        animateNumber(adminStatUsers, userCount || 0);
        
        const accuracy = total > 0 ? Math.round((matches / total) * 100) : 0;
        adminStatAccuracy.textContent = accuracy + "%";

    } catch (err) {
        console.error("Dashboard Stats Error:", err);
    }
  }

  async function fetchAdminScans() {
    const filter = filterAdminResult.value;
    adminScanTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">SYNCING...</td></tr>';

    try {
        let query = supabase
            .from('scans')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (filter !== 'ALL') {
            query = query.eq('result', filter);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            adminScanTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No records found</td></tr>';
            return;
        }

        adminScanTableBody.innerHTML = data.map(scan => {
            const time = new Date(scan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const badgeClass = scan.result === 'MATCH' ? 'badge-match' : 'badge-mismatch';
            return `
                <tr>
                    <td>${time}</td>
                    <td style="font-weight:700">${scan.scanned_by}</td>
                    <td style="font-size: 0.65rem; opacity: 0.7;">
                        C: ${truncate(scan.carton_barcode, 12)}<br>
                        L: ${truncate(scan.label_barcode, 12)}
                    </td>
                    <td><span class="badge ${badgeClass}">${scan.result}</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Fetch Scans Error:", err);
        adminScanTableBody.innerHTML = '<tr><td colspan="4" style="color:var(--error)">Error loading data</td></tr>';
    }
  }

  async function adminAddUser() {
    const fullName = document.getElementById("newUserFull").value.trim();
    const email = document.getElementById("newUserEmail").value.trim();
    const password = document.getElementById("newUserPass").value.trim();
    const role = document.getElementById("newUserRole").value;

    if (!fullName || !email || !password) {
        showToast("Fill all operator details", "warning");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be 6+ chars", "warning");
        return;
    }

    adminAddUserBtn.disabled = true;
    adminAddUserBtn.textContent = "PROVISIONING...";

    try {
        // 1. Sign Up in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });

        if (authError) throw authError;

        // 2. Create Profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role
            }]);

        if (profileError) throw profileError;

        showToast(`Staff account created for ${fullName}`, "success");
        
        // Reset fields
        document.getElementById("newUserFull").value = "";
        document.getElementById("newUserEmail").value = "";
        document.getElementById("newUserPass").value = "";
        
        fetchAdminStats(); // Refresh count

    } catch (err) {
        console.error("Provisioning Error:", err);
        showToast(err.message || "Failed to create user", "error");
    } finally {
        adminAddUserBtn.disabled = false;
        adminAddUserBtn.textContent = "Create Access Profile";
    }
  }

  function exportCSV() {
    const table = document.getElementById("adminScanTable");
    let csv = "Time,Staff,Details,Status\n";
    const rows = adminScanTableBody.querySelectorAll("tr");
    
    rows.forEach(row => {
        const cols = row.querySelectorAll("td");
        if (cols.length === 4) {
            const time = cols[0].innerText;
            const staff = cols[1].innerText;
            const details = cols[2].innerText.replace(/\n/g, ' | ');
            const status = cols[3].innerText;
            csv += `"${time}","${staff}","${details}","${status}"\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Matchbox_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ─── Start ─────────────────────────────────
  init();
})();