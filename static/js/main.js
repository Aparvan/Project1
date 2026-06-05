// Global UI state variables
let statsChart = null;
let benchmarkLatencyChart = null;
let benchmarkConfidenceChart = null;
let lossChart = null;
let mapChart = null;

let currentDetections = [];
let trainingEventSource = null;
let activeAlertPolling = null;
let liveScannerInterval = null;
let currentIsVideo = false;

let leafletMap = null;
let mapMarkersList = [];
let currentCamera = "Cam-01";
let currentUserRole = "Guest";
let currentUserName = "";
let spokenAlertsCooldown = {}; // {label: timestamp}
let localWebcamStream = null;
let webcamAnalysisInterval = null;


// Sanctuary GPS Coordinates mapping
const CAMERA_COORDINATES = {
    "Cam-01": { name: "Watering Hole, Serengeti (Cam-01)", coords: [-1.2921, 34.8219], hint: "Savanna Grasslands, Tanzania" },
    "Cam-02": { name: "North Station, Serengeti (Cam-02)", coords: [-1.3524, 34.8510], hint: "Perimeter Gate, Tanzania" },
    "Cam-03": { name: "Deep Canopy, Serengeti (Cam-03)", coords: [-1.2750, 34.8012], hint: "Predator Canopy Trail, Tanzania" },
    "Cam-04": { name: "Corbett Tiger Reserve (Cam-04)", coords: [29.5302, 78.7747], hint: "Tiger Reserve, Uttarakhand, India" },
    "Cam-05": { name: "Amazon Canopy (Cam-05)", coords: [-3.4653, -62.2159], hint: "Tropical Jungle Canopy, Amazonas, Brazil" },
    "Cam-06": { name: "Yellowstone Grizzly Trail (Cam-06)", coords: [44.4280, -110.5885], hint: "Geothermal Bear Forest, Wyoming, USA" },
    "Cam-07": { name: "Kangaroo Island (Cam-07)", coords: [-35.7752, 137.2142], hint: "Island Wildlife Sanctuary, South Australia" },
    "Cam-08": { name: "Svalbard Outpost (Cam-08)", coords: [78.2232, 15.6267], hint: "Glacial Ice Cap Station, Svalbard, Norway" }
};

function populateCameraUI() {
    const mapCamList = document.getElementById("mapCamList");
    const switchboardList = document.getElementById("switchboardList");
    
    if (mapCamList) {
        mapCamList.innerHTML = "";
        Object.keys(CAMERA_COORDINATES).forEach((key, idx) => {
            const item = CAMERA_COORDINATES[key];
            const div = document.createElement("div");
            div.className = `cam-node-card ${idx === 0 ? 'active' : ''}`;
            div.id = `map-card-${key}`;
            div.onclick = (event) => {
                document.querySelectorAll(".cam-node-card").forEach(c => c.classList.remove("active"));
                div.classList.add("active");
                if (leafletMap) {
                    leafletMap.setView(item.coords, 13);
                    mapMarkersList[key].openPopup();
                }
            };
            div.innerHTML = `
                <div class="node-title">${item.name} <span class="node-pulse green"></span></div>
                <div class="node-gps hud-mono">Lat: ${item.coords[0].toFixed(4)}, Lng: ${item.coords[1].toFixed(4)}</div>
                <div class="node-stats">${item.hint}</div>
            `;
            mapCamList.appendChild(div);
        });
    }

    if (switchboardList) {
        switchboardList.innerHTML = "";
        Object.keys(CAMERA_COORDINATES).forEach((key, idx) => {
            const item = CAMERA_COORDINATES[key];
            const btn = document.createElement("button");
            btn.id = `btn${key}`;
            btn.className = `btn-action ${idx === 0 ? 'active-cam' : ''}`;
            btn.onclick = () => switchCameraFeed(key);
            
            let icon = "videocam";
            if (item.name.toLowerCase().includes("watering")) icon = "water";
            else if (item.name.toLowerCase().includes("ranger") || item.name.toLowerCase().includes("station")) icon = "fence";
            else if (item.name.toLowerCase().includes("canopy") || item.name.toLowerCase().includes("forest") || item.name.toLowerCase().includes("amazon")) icon = "forest";
            else if (item.name.toLowerCase().includes("valley") || item.name.toLowerCase().includes("corbett")) icon = "terrain";
            else if (item.name.toLowerCase().includes("grizzly") || item.name.toLowerCase().includes("trail")) icon = "hiking";
            else if (item.name.toLowerCase().includes("glacial") || item.name.toLowerCase().includes("svalbard")) icon = "ac_unit";
            
            btn.innerHTML = `<span class="material-icons-outlined" style="vertical-align:middle; margin-right:0.4rem; font-size:1.1rem;">${icon}</span>${item.name}`;
            switchboardList.appendChild(btn);
        });
    }
}

// HSL color maps for distinct object labels
const CLASS_COLORS = {
    'person': 'hsl(200, 90%, 50%)',
    'dog': 'hsl(140, 80%, 45%)',
    'cat': 'hsl(300, 80%, 60%)',
    'bird': 'hsl(180, 85%, 45%)',
    'horse': 'hsl(30, 85%, 50%)',
    'sheep': 'hsl(0, 0%, 80%)',
    'cow': 'hsl(10, 60%, 55%)',
    'elephant': 'hsl(270, 75%, 65%)',
    'bear': 'hsl(0, 85%, 55%)',
    'zebra': 'hsl(0, 0%, 40%)',
    'giraffe': 'hsl(45, 95%, 50%)',
};

function getLabelColor(label) {
    if (CLASS_COLORS[label]) return CLASS_COLORS[label];
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 85%, 55%)`;
}

// -------------------------------------------------------------
// SPA NAVIGATION & INITIALIZATION
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    checkUserStatus();
    initNavigation();
    initDragAndDrop();
    initConfidenceSlider();
    initLeafletMap();
    populateCameraUI();
    loadStats();
    loadHistory();
    loadThreatPrediction();
    renderResearchCharts();
    loadEncyclopedia();
    
    // Set clock in camera HUD overlay
    setInterval(() => {
        const hudTime = document.getElementById("camHudTime");
        if (hudTime) {
            hudTime.innerText = "TIME: " + new Date().toLocaleTimeString();
        }
    }, 1000);

    // Reload simulated camera feed if species override is changed
    const webcamSpeciesOverrideInput = document.getElementById("webcamSpeciesOverride");
    if (webcamSpeciesOverrideInput) {
        webcamSpeciesOverrideInput.addEventListener("change", () => {
            const stream = document.getElementById("cameraStream");
            const btnStop = document.getElementById("btnStopCamera");
            if (btnStop && btnStop.style.display === "block" && !localWebcamStream && stream && stream.style.display !== "none") {
                fallbackToSimulationFeed();
            }
        });
        webcamSpeciesOverrideInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const stream = document.getElementById("cameraStream");
                const btnStop = document.getElementById("btnStopCamera");
                if (btnStop && btnStop.style.display === "block" && !localWebcamStream && stream && stream.style.display !== "none") {
                    fallbackToSimulationFeed();
                }
            }
        });
    }
});

function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".page-section");
    const pageTitleText = document.getElementById("pageTitleText");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            navItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            
            sections.forEach(s => s.classList.remove("active"));
            const targetSection = document.getElementById(targetTab);
            if (targetSection) targetSection.classList.add("active");

            // Update page title
            const labelText = item.querySelector("button").textContent.replace(/[^\w\s]/gi, '').trim();
            pageTitleText.innerText = labelText.toUpperCase();

            // Stop webcam stream if leaving the Cams tab
            if (targetTab !== "camera") {
                toggleWebcam(false);
            }

            // Load data dynamically
            if (targetTab === "dashboard") {
                loadStats();
                loadThreatPrediction();
            } else if (targetTab === "history") {
                loadHistory();
            } else if (targetTab === "map-tracking") {
                setTimeout(() => {
                    if (leafletMap) leafletMap.invalidateSize();
                }, 200);
            }
        });
    });
}

// -------------------------------------------------------------
// OPERATOR AUTHENTICATION HANDLERS
// -------------------------------------------------------------
function checkUserStatus() {
    fetch("/user_status")
        .then(res => res.json())
        .then(data => {
            updateAuthUI(data);
        });
}

function updateAuthUI(user) {
    const roleText = document.getElementById("opRoleText");
    const nameText = document.getElementById("opNameText");
    const lockIcon = document.getElementById("lockIcon");
    const btnLock = document.getElementById("btnAuthToggle");
    const restrictionInfo = document.getElementById("dbRoleRestrictionInfo");

    if (user.logged_in) {
        currentUserRole = user.role;
        currentUserName = user.username;
        
        roleText.innerText = user.role.toUpperCase() + " ACTIVE";
        nameText.innerText = "Operator: " + user.username;
        lockIcon.innerText = "lock";
        btnLock.classList.add("authorized");
        
        if (restrictionInfo) {
            restrictionInfo.innerText = "*Authorized operator access active. Operations enabled.";
            restrictionInfo.style.color = "var(--accent-success)";
        }
    } else {
        currentUserRole = "Guest";
        currentUserName = "";
        
        roleText.innerText = "GUEST OPERATOR";
        nameText.innerText = "Click Lock to Login";
        lockIcon.innerText = "lock_open";
        btnLock.classList.remove("authorized");
        
        if (restrictionInfo) {
            restrictionInfo.innerText = "*Ranger/Admin credentials required to clear records.";
            restrictionInfo.style.color = "var(--text-muted)";
        }
    }
}

function handleAuthToggle() {
    if (currentUserRole !== "Guest") {
        // Log out
        fetch("/logout", { method: "POST" })
            .then(res => res.json())
            .then(() => {
                checkUserStatus();
                loadHistory(); // Refresh buttons
            });
    } else {
        toggleLoginModal(true);
    }
}

function toggleLoginModal(show) {
    const modal = document.getElementById("loginModal");
    modal.style.display = show ? "flex" : "none";
    document.getElementById("loginError").style.display = "none";
}

function submitLogin() {
    const userVal = document.getElementById("usernameInput").value;
    const passVal = document.getElementById("passwordInput").value;
    
    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userVal, password: passVal })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                const errDiv = document.getElementById("loginError");
                errDiv.innerText = data.error;
                errDiv.style.display = "block";
            } else {
                toggleLoginModal(false);
                checkUserStatus();
                loadHistory(); // Refresh actions
            }
        })
        .catch(err => {
            console.error("Login failed:", err);
        });
}

// -------------------------------------------------------------
// LEAFLET SATELLITE MAP Sentinel
// -------------------------------------------------------------
function initLeafletMap() {
    // Center of Serengeti coordinates
    leafletMap = L.map('leafletMap').setView([-1.2921, 34.8219], 11);
    
    // Add premium real-world Satellite Hybrid map layer (Google Hybrid)
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps Satellite Imagery',
        maxZoom: 20
    }).addTo(leafletMap);

    // Plot default camera sensors markers
    Object.keys(CAMERA_COORDINATES).forEach(key => {
        const item = CAMERA_COORDINATES[key];
        const marker = L.marker(item.coords).addTo(leafletMap);
        marker.bindPopup(`<strong>${item.name}</strong><br>${item.hint}`);
        mapMarkersList[key] = marker;
    });
}

function flyToMapNode(camId) {
    const item = CAMERA_COORDINATES[camId];
    if (item && leafletMap) {
        // Toggle selected state in HTML
        document.querySelectorAll(".cam-node-card").forEach(c => c.classList.remove("active"));
        event.currentTarget.classList.add("active");
        
        leafletMap.setView(item.coords, 14);
        mapMarkersList[camId].openPopup();
    }
}

function plotSightingAlertsOnMap(markersData) {
    if (!leafletMap || !markersData) return;
    
    // Clear temporary pulses/markers
    leafletMap.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker && !Object.values(mapMarkersList).includes(layer)) {
            leafletMap.removeLayer(layer);
        }
    });

    // Plot dynamic sighting hotspots
    markersData.forEach(item => {
        const color = item.is_danger ? "var(--accent-danger)" : "var(--accent-cyan)";
        const circle = L.circleMarker([item.lat, item.lng], {
            radius: 12,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.35
        }).addTo(leafletMap);
        
        circle.bindPopup(`<strong>Sightings Detected</strong><br>Cam: ${item.camera_id}<br>Animals: ${item.label}<br>Time: ${item.created_at}`);
    });
}

// -------------------------------------------------------------
// OPERATIONAL OVERVIEW LOGIC
// -------------------------------------------------------------
function loadStats() {
    fetch("/stats")
        .then(res => res.json())
        .then(data => {
            document.getElementById("statTotalSessions").innerText = data.total_sessions;
            document.getElementById("statTotalObjects").innerText = data.total_objects;
            document.getElementById("statAvgConf").innerText = `${(data.avg_confidence * 100).toFixed(0)}%`;
            document.getElementById("statAvgLatency").innerText = `${data.avg_latency_ms.toFixed(0)} ms`;

            // Perimeter threats logging
            const list = document.getElementById("dangerAlertsList");
            list.innerHTML = "";
            if (data.danger_alerts.length === 0) {
                list.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem;">No danger logs yet.</div>`;
            } else {
                data.danger_alerts.forEach(alert => {
                    const div = document.createElement("div");
                    div.className = "alert-item";
                    div.innerHTML = `
                        <div class="alert-title">
                            <span class="material-icons-outlined">gpp_maybe</span>
                            PREDATOR ALERT: ${alert.label.toUpperCase()}
                        </div>
                        <div>
                            <span style="font-weight: 700; color: var(--accent-cyan); margin-right: 1rem;">
                                ${(alert.confidence * 100).toFixed(0)}%
                            </span>
                            <span class="alert-time">${alert.created_at}</span>
                        </div>
                    `;
                    list.appendChild(div);
                });
            }

            renderFrequencyChart(data.top_detections);
            plotSightingAlertsOnMap(data.map_markers);
        })
        .catch(err => console.error("Error fetching stats:", err));
}

function loadThreatPrediction() {
    fetch("/threat_prediction")
        .then(res => res.json())
        .then(data => {
            const badge = document.getElementById("threatStatusBadge");
            const meterFill = document.getElementById("threatMeterFill");
            const meterLabel = document.getElementById("threatMeterLabel");
            const forecastsList = document.getElementById("forecastsList");

            badge.innerText = data.threat_status.toUpperCase();
            
            // Set risk colors
            badge.className = "badge-status";
            if (data.threat_status === "High Threat") {
                badge.classList.add("danger", "glow-danger");
            } else if (data.threat_status === "Moderate Threat") {
                badge.classList.add("warning");
            } else {
                badge.classList.add("success");
            }

            meterFill.style.width = `${data.overall_threat_pct}%`;
            meterLabel.innerText = `${data.overall_threat_pct}% Threat Index`;

            forecastsList.innerHTML = "";
            data.forecasts.forEach(f => {
                const riskClass = f.risk.toLowerCase().replace(" risk", "");
                const row = document.createElement("div");
                row.className = "forecast-row";
                row.innerHTML = `
                    <span class="forecast-sector">${f.sector}</span>
                    <span class="forecast-window hud-mono">${f.window}</span>
                    <span class="forecast-risk ${riskClass}">${f.risk.toUpperCase()}</span>
                `;
                forecastsList.appendChild(row);
            });
        });
}

function renderFrequencyChart(topDetections) {
    const ctx = document.getElementById("frequencyChart").getContext("2d");
    if (statsChart) statsChart.destroy();

    if (!topDetections || topDetections.length === 0) return;

    const labels = topDetections.map(d => d.label.toUpperCase());
    const counts = topDetections.map(d => d.count);
    const colors = topDetections.map(d => getLabelColor(d.label));

    statsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'hsl(220, 15%, 70%)',
                        font: { family: 'Share Tech Mono', size: 11 }
                    }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// SIGHTINGS DETECTOR (FILE UPLOADER & OVERLAYS)
// -------------------------------------------------------------
function initDragAndDrop() {
    const zone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("fileInput");

    zone.addEventListener("click", () => fileInput.click());

    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            handleUpload(fileInput.files[0]);
        }
    });
}

function handleUpload(file) {
    const formData = new FormData();
    formData.append("image", file);
    
    const selectedModel = document.getElementById("modelSelect").value;
    formData.append("model", selectedModel);

    const cameraUploadSelect = document.getElementById("cameraUploadSelect").value;
    formData.append("camera_id", cameraUploadSelect);

    const speciesOverride = document.getElementById("speciesOverrideInput").value.trim();
    formData.append("species_override", speciesOverride);

    const zone = document.getElementById("uploadZone");
    zone.innerHTML = `
        <span class="material-icons-outlined upload-icon" style="animation: spin 2s infinite linear;">refresh</span>
        <h3 class="upload-text hud-mono">RUNNING CNN PIPELINE...</h3>
        <p class="upload-hint">Performing object detection & animal intelligence lookup</p>
    `;

    fetch("/detect", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            zone.innerHTML = `
                <span class="material-icons-outlined upload-icon">cloud_upload</span>
                <h3 class="upload-text hud-mono">DISPATCH MEDIA FILES FOR LOCAL DEEP LEARNING</h3>
                <p class="upload-hint">Supports PNG, JPG, MP4, AVI up to 32MB (Tip: Rename file to target species name or use the config override panel)</p>
            `;

            if (data.error) {
                alert(data.error);
                return;
            }

            document.getElementById("speciesOverrideInput").value = "";
            displayDetections(data);
            
            // Trigger alerts & Text-to-Speech warnings
            if (data.dangerous_detected) {
                const predator = data.detections.find(d => ['bear', 'elephant', 'tiger', 'lion', 'crocodile', 'snake', 'leopard', 'wolf'].includes(d.label));
                triggerDangerAlarm(predator);
            }
        })
        .catch(err => {
            console.error(err);
            zone.innerHTML = `
                <span class="material-icons-outlined upload-icon">cloud_upload</span>
                <h3 class="upload-text">Upload Pipeline Error</h3>
                <p class="upload-hint">Click here to retry</p>
            `;
        });
}

function displayDetections(data) {
    const imgElement = document.getElementById("displayImage");
    const videoElement = document.getElementById("displayVideo");
    const overlay = document.getElementById("svgOverlay");
    const container = document.getElementById("visualizerContainer");

    container.style.display = "block";
    currentIsVideo = !!data.is_video;

    // Reset intelligence card
    document.getElementById("intelPanel").style.display = "none";

    if (currentIsVideo) {
        imgElement.style.display = "none";
        overlay.style.display = "none";
        videoElement.style.display = "block";
        videoElement.src = data.image_url;
        
        currentDetections = data.detections;
        renderDetections();
    } else {
        imgElement.style.display = "block";
        overlay.style.display = "block";
        videoElement.style.display = "none";
        videoElement.src = "";
        
        imgElement.src = data.image_url;
        imgElement.onload = () => {
            currentDetections = data.detections;
            renderDetections();
        };
    }
}

function initConfidenceSlider() {
    const slider = document.getElementById("confSlider");
    const label = document.getElementById("sliderValue");

    slider.addEventListener("input", (e) => {
        const val = e.target.value;
        label.innerText = `${val}%`;
        renderDetections();
    });
}

function renderDetections() {
    const threshold = parseFloat(document.getElementById("confSlider").value) / 100.0;
    const overlay = document.getElementById("svgOverlay");
    const list = document.getElementById("detectionList");
    
    overlay.innerHTML = "";
    list.innerHTML = "";

    const filtered = currentDetections.filter(d => d.confidence >= threshold);

    if (filtered.length === 0) {
        list.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:2rem;">No items match confidence cutoff.</div>`;
        return;
    }

    filtered.forEach((det, idx) => {
        const color = getLabelColor(det.label);
        let rect = null;
        
        if (!currentIsVideo) {
            const [x_min, y_min, x_max, y_max] = det.box;
            const x = x_min * 100;
            const y = y_min * 100;
            const w = (x_max - x_min) * 100;
            const h = (y_max - y_min) * 100;

            // Draw SVG Bounding Box Rect
            rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", w);
            rect.setAttribute("height", h);
            rect.setAttribute("class", "bbox-rect");
            rect.setAttribute("stroke", color);
            rect.setAttribute("id", `box-rect-${idx}`);
            rect.style.pointerEvents = "auto";
            overlay.appendChild(rect);

            // Draw SVG Label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x);
            text.setAttribute("y", y - 2 > 0 ? y - 2 : y + 10);
            text.setAttribute("class", "bbox-label");
            text.setAttribute("fill", "white");
            const typeStr = det.intelligence ? ` [${det.intelligence.category}]` : '';
            text.textContent = `${det.label.toUpperCase()}${typeStr} #${det.tracking_id} ${(det.confidence * 100).toFixed(0)}%`;
            overlay.appendChild(text);

            // Bounding box click listener
            rect.addEventListener("click", () => showAnimalIntelligenceCard(det));
        }

        // Add to Sidebar Sighted List
        const card = document.createElement("div");
        card.className = "detection-badge";
        card.setAttribute("id", `badge-card-${idx}`);
        
        const is_danger = ['bear', 'elephant', 'tiger', 'lion', 'crocodile', 'snake', 'leopard', 'wolf'].includes(det.label.toLowerCase());
        
        card.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; gap: 0.3rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="badge-label" style="text-transform: capitalize; font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${det.label}</span>
                    <span class="badge-conf" style="color: ${color}; font-weight: 700; font-size: 0.95rem;">${(det.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-secondary); width: 100%;">
                    <span>ID: #${det.tracking_id || 'N/A'} | Class: <strong>${det.intelligence ? det.intelligence.category : 'Unknown'}</strong> | Age: <strong>${det.age || 'Adult'}</strong></span>
                    <span class="info-status" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; line-height: 1;
                        ${is_danger ? 'background: hsla(0, 85%, 55%, 0.15); color: var(--accent-danger); border: 1px solid var(--accent-danger);' : 'background: hsla(140, 80%, 48%, 0.15); color: var(--accent-success); border: 1px solid var(--accent-success);'}">
                        ${is_danger ? 'DANGER' : 'SAFE'}
                    </span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left;">
                    Condition: <strong style="color: var(--text-secondary);">${det.health || 'Healthy / Active'}</strong> | Heading: <strong style="color: var(--text-secondary);">${det.heading || 'Stationary'}</strong>
                </div>
            </div>
        `;
        
        card.addEventListener("click", () => showAnimalIntelligenceCard(det));
        
        if (!currentIsVideo && rect) {
            card.addEventListener("mouseenter", () => {
                rect.classList.add("highlighted");
                card.classList.add("highlighted");
            });
            card.addEventListener("mouseleave", () => {
                rect.classList.remove("highlighted");
                card.classList.remove("highlighted");
            });
        }
        
        list.appendChild(card);
    });
}

function showAnimalIntelligenceCard(det) {
    const intel = det.intelligence;
    if (!intel) return;

    const panel = document.getElementById("intelPanel");
    panel.style.display = "block";

    document.getElementById("intelAnimalName").innerText = det.label;
    
    const dangerBadge = document.getElementById("intelDangerLevel");
    dangerBadge.innerText = `DANGER LEVEL: ${intel.danger_level.toUpperCase()}`;
    dangerBadge.className = "badge-status";
    if (intel.danger_level.toLowerCase().includes("high") || intel.danger_level.toLowerCase().includes("extreme")) {
        dangerBadge.classList.add("danger", "glow-danger");
    } else if (intel.danger_level.toLowerCase().includes("medium")) {
        dangerBadge.classList.add("warning");
    } else {
        dangerBadge.classList.add("success");
    }

    document.getElementById("intelScientificName").innerText = intel.scientific_name;
    document.getElementById("intelCategory").innerText = intel.category;
    document.getElementById("intelConservation").innerText = intel.conservation_status;
    document.getElementById("intelLifespan").innerText = intel.lifespan;
    document.getElementById("intelEstimatedAge").innerText = det.age || "Adult";
    document.getElementById("intelHealthStatus").innerText = det.health || "Healthy";
    document.getElementById("intelRegions").innerText = intel.regions;
    document.getElementById("intelHabitats").innerText = intel.habitat;
    document.getElementById("intelDiet").innerText = intel.diet;
    document.getElementById("intelHeading").innerText = det.heading || "Stationary";
    document.getElementById("intelBreedDetails").innerText = intel.breed_details;
    document.getElementById("intelSound").innerText = intel.sound;
    document.getElementById("intelDescription").innerHTML = intel.description;
    document.getElementById("intelSafety").innerText = intel.safety_recommendations;

    // Smooth scroll down to panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// -------------------------------------------------------------
// LIVE MONITOR WEBCAM SWITCHER & SIRENS
// -------------------------------------------------------------
function switchCameraFeed(camId) {
    currentCamera = camId;
    
    // Toggle active button
    document.querySelectorAll(".cam-controls-sidebar .btn-action").forEach(btn => {
        btn.classList.remove("active-cam");
    });
    
    const item = CAMERA_COORDINATES[camId];
    if (item) {
        const btn = document.getElementById(`btn${camId}`);
        if (btn) btn.classList.add("active-cam");
        
        document.getElementById("activeFeedTitle").innerText = `${item.name.toUpperCase()} FEED // ${camId.toUpperCase()}`;
        document.getElementById("camHudGps").innerText = `GPS: ${item.coords[0].toFixed(4)}, ${item.coords[1].toFixed(4)}`;
        
        // If system is currently scanning (btnStopCamera is visible), update source
        const btnStop = document.getElementById("btnStopCamera");
        if (btnStop && btnStop.style.display === "block") {
            if (localWebcamStream) {
                // Webcam is already running, just update the status HUD text and continue
                const statusText = document.getElementById("camHudStatus");
                if (statusText) {
                    statusText.innerHTML = "SYS.TRACKING: ACTIVE (WEBCAM)<br>MODEL: YOLOv8-NANO";
                }
                const fpsText = document.getElementById("camHudFps");
                if (fpsText) {
                    fpsText.innerText = "FPS: 2.5";
                }
            } else {
                // If webcam is not running (e.g. permission was denied or failed), fallback to simulated feed
                fallbackToSimulationFeed();
            }
        } else {
            // Telemetry scanning is off, keep screen blank
            stopWebcamStream();
            const stream = document.getElementById("cameraStream");
            const browserWebcam = document.getElementById("browserWebcam");
            const browserSvgOverlay = document.getElementById("browserSvgOverlay");
            if (stream) {
                stream.style.display = "none";
                stream.src = "";
            }
            if (browserWebcam) {
                browserWebcam.style.display = "none";
                browserWebcam.srcObject = null;
            }
            if (browserSvgOverlay) {
                browserSvgOverlay.style.display = "none";
            }
        }
        
        // Force snap poll telemetry immediately on switch
        if (liveScannerInterval) {
            pollLiveTelemetry();
        }
    }
}

function handleSimKeyPress(event) {
    if (event.key === "Enter") {
        injectLiveSighting();
    }
}

function injectLiveSighting() {
    const input = document.getElementById("simSpeciesInput");
    const label = input.value.trim().toLowerCase();
    if (!label) return;
    
    fetch("/api/simulate_detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_id: currentCamera, label: label })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            input.value = "";
            // Trigger instant poll to update UI
            pollLiveTelemetry();
        }
    })
    .catch(err => {
        console.error("Simulation injection failed:", err);
    });
}

function renderTelemetryDetections(data) {
    const scanBody = document.getElementById("liveScanBody");
    const indicator = document.getElementById("liveScanIndicator");
    const camIntelPanel = document.getElementById("camIntelPanel");
    
    if (!data || data.length === 0) {
        if (scanBody) scanBody.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:1.5rem 0;">Awaiting sensor signals...</div>`;
        if (indicator) {
            indicator.innerText = "SCANNING...";
            indicator.className = "badge-status info";
        }
        if (camIntelPanel) camIntelPanel.style.display = "none";
        return;
    }
    
    if (indicator) {
        indicator.innerText = "DETECTION ACTIVE";
        indicator.className = "badge-status success";
    }
    
    // Auto-populate active target profile card
    const latestDet = data[0];
    const intel = latestDet.intelligence;
    if (intel && camIntelPanel) {
        camIntelPanel.style.display = "block";
        const elName = document.getElementById("camIntelName");
        const elSci = document.getElementById("camIntelScientific");
        const elCat = document.getElementById("camIntelCategory");
        const elCons = document.getElementById("camIntelConservation");
        const elHab = document.getElementById("camIntelHabitat");
        const elDiet = document.getElementById("camIntelDiet");
        const elId = document.getElementById("camIntelId");
        const elHealth = document.getElementById("camIntelHealth");
        const elDesc = document.getElementById("camIntelDescription");
        const elSafety = document.getElementById("camIntelSafety");
        
        if (elName) elName.innerText = latestDet.label;
        if (elSci) elSci.innerText = intel.scientific_name || "N/A";
        if (elCat) elCat.innerText = intel.category || "N/A";
        if (elCons) elCons.innerText = intel.conservation_status || "N/A";
        if (elHab) elHab.innerText = intel.habitat || "N/A";
        if (elDiet) elDiet.innerText = intel.diet || "N/A";
        if (elId) elId.innerText = `#${latestDet.tracking_id || 'N/A'}`;
        if (elHealth) elHealth.innerText = latestDet.health || "Healthy / Active";
        if (elDesc) elDesc.innerText = intel.description || "N/A";
        if (elSafety) elSafety.innerText = intel.safety_recommendations || "N/A";
        
        const dangerBadge = document.getElementById("camIntelDanger");
        if (dangerBadge) {
            const dangerLevel = intel.danger_level || "Low";
            dangerBadge.innerText = `DANGER: ${dangerLevel.toUpperCase()}`;
            dangerBadge.className = "badge-status";
            if (dangerLevel.toLowerCase().includes("high") || dangerLevel.toLowerCase().includes("extreme")) {
                dangerBadge.classList.add("danger", "glow-danger");
            } else if (dangerLevel.toLowerCase().includes("medium")) {
                dangerBadge.classList.add("warning");
            } else {
                dangerBadge.classList.add("success");
            }
        }
    } else if (camIntelPanel) {
        camIntelPanel.style.display = "none";
    }
    
    if (scanBody) {
        scanBody.innerHTML = "";
        data.forEach(det => {
            const intel = det.intelligence || {
                scientific_name: "Unknown",
                category: "Unknown",
                conservation_status: "Unknown",
                lifespan: "Unknown",
                safety_recommendations: "None"
            };
            const color = getLabelColor(det.label);
            
            const div = document.createElement("div");
            div.style.padding = "0.5rem";
            div.style.background = "hsla(220, 20%, 15%, 0.4)";
            div.style.border = "1px solid var(--border-glass)";
            div.style.borderRadius = "4px";
            div.style.marginBottom = "0.5rem";
            div.style.borderLeft = `3px solid ${color}`;
            div.style.animation = "fadeIn 0.2s forwards";
            
            div.innerHTML = `
                <div style="font-weight:700; color:var(--text-primary); text-transform:uppercase; display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.8rem;">
                    <span>${det.label} [${intel.category}] #${det.tracking_id}</span>
                    <span style="color:${color};">${(det.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
                    • <strong>Scientific</strong>: <em>${intel.scientific_name}</em><br>
                    • <strong>Class/Status</strong>: ${intel.category} // <strong>${intel.conservation_status}</strong><br>
                    • <strong>Individual details</strong>: Age: ${det.age || 'Adult'} // Health: ${det.health || 'Healthy / Active'}<br>
                    • <strong>Movement Tracking</strong>: ${det.heading || 'Stationary'}<br>
                    • <strong>Avg Lifespan</strong>: ${intel.lifespan}
                </div>
                <div style="font-size:0.75rem; padding:0.4rem; border-radius:3px; background:rgba(0,0,0,0.25); color:var(--accent-cyan); line-height:1.3; margin-top:0.35rem; border-left: 2px solid var(--accent-cyan);">
                    <strong>Park Safety Guidelines:</strong> ${intel.safety_recommendations}
                </div>
            `;
            scanBody.appendChild(div);
        });
    }
}

function pollLiveTelemetry() {
    fetch(`/live_detections?camera=${currentCamera}`)
        .then(res => res.json())
        .then(data => {
            renderTelemetryDetections(data);
        })
        .catch(err => console.error("Live telemetry polling failed:", err));
}

function stopWebcamStream() {
    if (localWebcamStream) {
        localWebcamStream.getTracks().forEach(track => track.stop());
        localWebcamStream = null;
    }
    if (webcamAnalysisInterval) {
        clearInterval(webcamAnalysisInterval);
        webcamAnalysisInterval = null;
    }
    const browserSvgOverlay = document.getElementById("browserSvgOverlay");
    if (browserSvgOverlay) {
        browserSvgOverlay.innerHTML = "";
    }
}

function fallbackToSimulationFeed() {
    stopWebcamStream();

    const stream = document.getElementById("cameraStream");
    const browserWebcam = document.getElementById("browserWebcam");
    const browserSvgOverlay = document.getElementById("browserSvgOverlay");

    if (browserWebcam) browserWebcam.style.display = "none";
    if (browserSvgOverlay) browserSvgOverlay.style.display = "none";
    
    const speciesOverride = document.getElementById("webcamSpeciesOverride")?.value.trim() || "";
    if (stream) {
        stream.style.display = "block";
        stream.src = `/webcam_feed?camera=${currentCamera}&override=${encodeURIComponent(speciesOverride)}`;
    }

    const statusText = document.getElementById("camHudStatus");
    if (statusText) {
        statusText.innerHTML = "SYS.TRACKING: ACTIVE<br>MODEL: YOLOv8-NANO";
    }
    
    const fpsText = document.getElementById("camHudFps");
    if (fpsText) {
        fpsText.innerText = "FPS: 25.0";
    }
}

function toggleWebcam(active) {
    const stream = document.getElementById("cameraStream");
    const browserWebcam = document.getElementById("browserWebcam");
    const browserSvgOverlay = document.getElementById("browserSvgOverlay");
    const btnStart = document.getElementById("btnStartCamera");
    const btnStop = document.getElementById("btnStopCamera");
    const liveScannerPanel = document.getElementById("liveScannerPanel");
    const feedBox = document.querySelector(".camera-feed-box");
    const radarSweep = document.getElementById("radarSweep");

    if (active) {
        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "block";
        if (liveScannerPanel) liveScannerPanel.style.display = "block";
        if (feedBox) feedBox.classList.add("webcam-active");
        if (radarSweep) radarSweep.style.display = "block";

        // Always initiate browser-side real-time webcam access for whatever camera is selected if supported
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(mediaStream => {
                    localWebcamStream = mediaStream;
                    if (browserWebcam) {
                        browserWebcam.srcObject = mediaStream;
                        browserWebcam.style.display = "block";
                        browserWebcam.muted = true;
                        browserWebcam.play().catch(err => {
                            console.warn("Error playing webcam video element:", err);
                        });
                    }
                    if (browserSvgOverlay) {
                        browserSvgOverlay.style.display = "block";
                    }
                    if (stream) {
                        stream.style.display = "none";
                    }

                    const modelVal = document.getElementById("webcamModelSelect")?.value || "yolov8n";
                    const modelDisplay = modelVal === "yolov8m" ? "YOLOv8-MEDIUM" : (modelVal === "yolov8s" ? "YOLOv8-SMALL" : "YOLOv8-NANO");
                    const fpsDisplay = modelVal === "yolov8m" ? "0.8" : (modelVal === "yolov8s" ? "1.5" : "2.5");

                    const statusText = document.getElementById("camHudStatus");
                    if (statusText) {
                        statusText.innerHTML = `SYS.TRACKING: ACTIVE (WEBCAM)<br>MODEL: ${modelDisplay}`;
                    }
                    
                    const fpsText = document.getElementById("camHudFps");
                    if (fpsText) {
                        fpsText.innerText = `FPS: ${fpsDisplay}`;
                    }

                    // Start frame capture & detection loop
                    startWebcamAnalysisLoop();
                })
                .catch(err => {
                    console.warn("Webcam access denied/failed, falling back to simulated feed:", err);
                    fallbackToSimulationFeed();
                });
        } else {
            console.warn("Webcam media API not supported or blocked in insecure context. Falling back to simulated feed.");
            fallbackToSimulationFeed();
        }

        // Poll alerts in background to fetch database alarm alerts fired by streams
        if (activeAlertPolling) clearInterval(activeAlertPolling);
        activeAlertPolling = setInterval(() => {
            fetch("/stats")
                .then(res => res.json())
                .then(data => {
                    if (data.danger_alerts && data.danger_alerts.length > 0) {
                        const latestAlert = data.danger_alerts[0];
                        const alertTimeParts = latestAlert.created_at.match(/\d+:\d+:\d+/);
                        if (alertTimeParts) {
                            const now = new Date();
                            const timeStr = alertTimeParts[0];
                            const [h, m, s] = timeStr.split(":").map(Number);
                            const alertDate = new Date();
                            alertDate.setHours(h, m, s, 0);

                            if (Math.abs(now.getTime() - alertDate.getTime()) < 4000) {
                                triggerDangerAlarm(latestAlert);
                            }
                        }
                    }
                });
        }, 3000);

        // Start live telemetry polling for UI display
        pollLiveTelemetry();
        if (liveScannerInterval) clearInterval(liveScannerInterval);
        liveScannerInterval = setInterval(pollLiveTelemetry, 1500);

    } else {
        // Deactivate everything
        stopWebcamStream();

        if (stream) {
            stream.src = "";
            stream.style.display = "none";
        }
        if (browserWebcam) {
            browserWebcam.style.display = "none";
            browserWebcam.srcObject = null;
        }
        if (browserSvgOverlay) {
            browserSvgOverlay.style.display = "none";
        }
        if (feedBox) feedBox.classList.remove("webcam-active");
        if (radarSweep) radarSweep.style.display = "none";

        const tooltip = document.getElementById("webcamTooltip");
        if (tooltip) tooltip.style.display = "none";

        if (btnStart) btnStart.style.display = "block";
        if (btnStop) btnStop.style.display = "none";
        if (liveScannerPanel) liveScannerPanel.style.display = "none";
        document.getElementById("camIntelPanel").style.display = "none";

        if (activeAlertPolling) {
            clearInterval(activeAlertPolling);
            activeAlertPolling = null;
        }

        if (liveScannerInterval) {
            clearInterval(liveScannerInterval);
            liveScannerInterval = null;
        }
    }
}

function startWebcamAnalysisLoop() {
    if (webcamAnalysisInterval) {
        clearInterval(webcamAnalysisInterval);
    }

    const video = document.getElementById("browserWebcam");
    const canvas = document.getElementById("browserCanvas");
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext("2d");

    webcamAnalysisInterval = setInterval(() => {
        if (video.paused || video.ended || !localWebcamStream) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (!blob || !localWebcamStream) return;
            const speciesOverride = document.getElementById("webcamSpeciesOverride")?.value.trim() || "";
            const modelVal = document.getElementById("webcamModelSelect")?.value || "yolov8n";
            const logToDbVal = document.getElementById("webcamLogToggle")?.checked ? "true" : "false";

            const modelDisplay = modelVal === "yolov8m" ? "YOLOv8-MEDIUM" : (modelVal === "yolov8s" ? "YOLOv8-SMALL" : "YOLOv8-NANO");
            const fpsDisplay = modelVal === "yolov8m" ? "0.8" : (modelVal === "yolov8s" ? "1.5" : "2.5");

            const statusText = document.getElementById("camHudStatus");
            if (statusText) {
                statusText.innerHTML = `SYS.TRACKING: ACTIVE (WEBCAM)<br>MODEL: ${modelDisplay}`;
            }
            const fpsText = document.getElementById("camHudFps");
            if (fpsText) {
                fpsText.innerText = `FPS: ${fpsDisplay}`;
            }

            const formData = new FormData();
            formData.append("image", blob, "webcam_frame.jpg");
            formData.append("camera_id", currentCamera);
            formData.append("model", modelVal);
            formData.append("log_to_db", logToDbVal);
            if (speciesOverride) {
                formData.append("species_override", speciesOverride);
            }

            fetch("/api/webcam_detect", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && localWebcamStream) {
                    drawWebcamDetections(data.detections);
                    renderTelemetryDetections(data.detections);
                }
            })
            .catch(err => {
                console.error("Webcam detection upload failed:", err);
            });
        }, "image/jpeg", 0.7);
    }, 400);
}

function drawWebcamDetections(detections) {
    const overlay = document.getElementById("browserSvgOverlay");
    if (!overlay) return;
    overlay.innerHTML = "";

    detections.forEach((det, idx) => {
        const color = getLabelColor(det.label);
        const [x_min, y_min, x_max, y_max] = det.box;

        const x = x_min * 100;
        const y = y_min * 100;
        const w = (x_max - x_min) * 100;
        const h = (y_max - y_min) * 100;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", w);
        rect.setAttribute("height", h);
        rect.setAttribute("class", "bbox-rect");
        rect.setAttribute("stroke", color);
        rect.setAttribute("fill", "rgba(0,0,0,0)");
        rect.setAttribute("id", `webcam-rect-${idx}`);
        rect.setAttribute("style", "pointer-events: all; cursor: pointer;");
        overlay.appendChild(rect);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y - 2 > 0 ? y - 2 : y + 10);
        text.setAttribute("class", "bbox-label");
        text.setAttribute("fill", "white");
        const categoryStr = det.intelligence ? ` [${det.intelligence.category}]` : '';
        text.textContent = `${det.label.toUpperCase()}${categoryStr} #${det.tracking_id} ${(det.confidence * 100).toFixed(0)}%`;
        overlay.appendChild(text);

        // Bounding box mouse events for interactive tooltips
        rect.addEventListener("mouseenter", () => {
            const tooltip = document.getElementById("webcamTooltip");
            if (!tooltip) return;
            const intel = det.intelligence || {};
            tooltip.innerHTML = `
                <div style="font-weight:700; text-transform:uppercase; color:var(--text-primary); border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:3px; margin-bottom:5px;">
                    Target: ${det.label.toUpperCase()} #${det.tracking_id}
                </div>
                <div><strong>Scientific Name</strong>: <em>${intel.scientific_name || "N/A"}</em></div>
                <div><strong>Species Class</strong>: ${intel.category || "N/A"}</div>
                <div><strong>Endangered</strong>: ${intel.conservation_status || "N/A"}</div>
                <div><strong>Health status</strong>: ${det.health || "Healthy / Active"}</div>
                <div><strong>Movement heading</strong>: ${det.heading || "Stationary"}</div>
                <div><strong>Model Confidence</strong>: ${(det.confidence * 100).toFixed(0)}%</div>
            `;
            tooltip.style.borderColor = color;
            tooltip.style.display = "block";
            tooltip.style.opacity = "1";
        });

        rect.addEventListener("mousemove", (event) => {
            const tooltip = document.getElementById("webcamTooltip");
            const feedBox = document.querySelector(".camera-feed-box");
            if (!tooltip || !feedBox) return;
            
            const rectBox = feedBox.getBoundingClientRect();
            const tooltipX = event.clientX - rectBox.left + 15;
            const tooltipY = event.clientY - rectBox.top + 15;
            
            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${tooltipY}px`;
        });

        rect.addEventListener("mouseleave", () => {
            const tooltip = document.getElementById("webcamTooltip");
            if (tooltip) {
                tooltip.style.opacity = "0";
                tooltip.style.display = "none";
            }
        });
    });
}

// -------------------------------------------------------------
// THREAT WARNING SYSTEM & TTS VOCAL ALERTS
// -------------------------------------------------------------
let alarmAudioCtx = null;
let alarmAudioInterval = null;

function playSirenTone() {
    try {
        if (!alarmAudioCtx) {
            alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (alarmAudioCtx.state === 'suspended') {
            alarmAudioCtx.resume();
        }
        const osc = alarmAudioCtx.createOscillator();
        const gain = alarmAudioCtx.createGain();
        osc.type = 'sawtooth';
        const now = alarmAudioCtx.currentTime;
        
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.25);
        osc.frequency.linearRampToValueAtTime(550, now + 0.5);
        
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.45);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.5);
        
        osc.connect(gain);
        gain.connect(alarmAudioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    } catch(e) {
        console.warn("Audio Context blocked:", e);
    }
}

function triggerDangerAlarm(detection) {
    if (!detection) return;

    const overlay = document.getElementById("alarmOverlay");
    const msg = document.getElementById("alarmMessage");
    const label = detection.label;

    msg.innerText = `Proximity warning! A wild ${label.toUpperCase()} (${(detection.confidence * 100).toFixed(0)}% confidence) was detected crossing the sensor grid.`;
    overlay.style.display = "flex";

    // Play siren
    if (alarmAudioInterval) clearInterval(alarmAudioInterval);
    playSirenTone();
    alarmAudioInterval = setInterval(playSirenTone, 900);

    // Dynamic SOTA browser Speech Warning (Vocal Text-to-Speech)
    const now = Date.now();
    if (!spokenAlertsCooldown[label] || (now - spokenAlertsCooldown[label] > 20000)) {
        spokenAlertsCooldown[label] = now;
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const speakMsg = new SpeechSynthesisUtterance(`Warning. Threat alert. A ${label} has been sighted in the proximity zones. Take safety precautions.`);
            speakMsg.rate = 0.95;
            window.speechSynthesis.speak(speakMsg);
        }
    }
}

function dismissAlarm() {
    document.getElementById("alarmOverlay").style.display = "none";
    if (alarmAudioInterval) {
        clearInterval(alarmAudioInterval);
        alarmAudioInterval = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// -------------------------------------------------------------
// TELEMETRY DATABASE LOGGER VIEW
// -------------------------------------------------------------
function loadHistory() {
    fetch("/sessions")
        .then(res => res.json())
        .then(data => {
            const body = document.getElementById("historyTableBody");
            body.innerHTML = "";

            if (data.length === 0) {
                body.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records in database.</td></tr>`;
                return;
            }

            data.forEach(s => {
                const tr = document.createElement("tr");
                
                // Summarize detections
                const counts = {};
                s.detections.forEach(d => {
                    counts[d.label] = (counts[d.label] || 0) + 1;
                });
                const summary = Object.entries(counts).map(([label, count]) => `${count}x ${label}`).join(", ") || "None";

                // Lock/restrict delete access based on logged in role
                const canDelete = ["Administrator", "Ranger"].includes(currentUserRole);
                const deleteBtn = canDelete 
                    ? `<button class="btn-action btn-delete-action" onclick="deleteSessionHistory(${s.id})">Delete</button>`
                    : `<button class="btn-action" style="opacity:0.3; cursor:not-allowed;" title="Admin credentials required" onclick="alert('Access Denied: Admin or Ranger privileges required.')">Delete</button>`;

                tr.innerHTML = `
                    <td>${s.created_at}</td>
                    <td style="font-weight: 500;">${s.filename}</td>
                    <td><span style="font-family: monospace; font-size:0.8rem;">${s.model_name}</span></td>
                    <td>${s.camera_id}</td>
                    <td>${s.inference_time_ms.toFixed(0)} ms</td>
                    <td>${summary}</td>
                    <td style="display:flex; gap:0.5rem;">
                        <button class="btn-action" onclick="viewSessionHistory(${s.id})">Inspect</button>
                        ${deleteBtn}
                    </td>
                `;
                body.appendChild(tr);
            });
        })
        .catch(err => console.error(err));
}

function deleteSessionHistory(id) {
    if (!confirm("Confirm operator deletion? Bounding boxes and stored image bytes will be permanently erased.")) {
        return;
    }

    fetch(`/session/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                loadHistory();
            }
        })
        .catch(err => console.error(err));
}

function viewSessionHistory(id) {
    fetch(`/session/${id}`)
        .then(res => res.json())
        .then(data => {
            // Switch tab to Detection
            const navItems = document.querySelectorAll(".nav-item");
            const sections = document.querySelectorAll(".page-section");

            navItems.forEach(i => i.classList.remove("active"));
            const detTab = document.querySelector("[data-tab='detection']");
            if (detTab) detTab.classList.add("active");

            sections.forEach(s => s.classList.remove("active"));
            const detSect = document.getElementById("detection");
            if (detSect) detSect.classList.add("active");

            document.getElementById("pageTitleText").innerText = "SIGHTING ANALYZER";

            displayDetections(data);
        })
        .catch(err => console.error(err));
}

// -------------------------------------------------------------
// SOTA INTERACTIVE BENCHMARK RUN
// -------------------------------------------------------------
function triggerBenchmark() {
    const loading = document.getElementById("benchmarkLoading");
    const charts = document.getElementById("benchmarkCharts");
    const btn = document.getElementById("btnBenchmark");

    loading.style.display = "block";
    charts.style.opacity = "0.2";
    btn.disabled = true;

    fetch("/benchmark", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            loading.style.display = "none";
            charts.style.opacity = "1";
            btn.disabled = false;

            if (data.error) {
                alert(data.error);
                return;
            }

            renderBenchmarkCharts(data);
        })
        .catch(err => {
            console.error(err);
            loading.style.display = "none";
            charts.style.opacity = "1";
            btn.disabled = false;
            alert("Benchmark failed. Please upload an image under 'Sighting Analyzer' first.");
        });
}

function renderBenchmarkCharts(data) {
    const models = Object.keys(data);
    const modelLabels = models.map(m => data[m].model_name);
    const latencies = models.map(m => data[m].latency_ms);
    const confs = models.map(m => data[m].avg_confidence * 100);

    // Latency Chart
    const ctxL = document.getElementById("benchmarkLatencyChart").getContext("2d");
    if (benchmarkLatencyChart) benchmarkLatencyChart.destroy();
    benchmarkLatencyChart = new Chart(ctxL, {
        type: 'bar',
        data: {
            labels: modelLabels,
            datasets: [{
                label: 'Inference speed (Latency in ms)',
                data: latencies,
                backgroundColor: ['hsla(180, 100%, 50%, 0.6)', 'hsla(220, 20%, 60%, 0.5)', 'hsla(220, 20%, 60%, 0.5)', 'hsla(220, 20%, 60%, 0.5)', 'hsla(220, 20%, 60%, 0.5)'],
                borderColor: ['hsl(180, 100%, 50%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } }
            },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });

    // Confidence Chart
    const ctxC = document.getElementById("benchmarkConfidenceChart").getContext("2d");
    if (benchmarkConfidenceChart) benchmarkConfidenceChart.destroy();
    benchmarkConfidenceChart = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: modelLabels,
            datasets: [{
                label: 'Average Confidence Quotient (%)',
                data: confs,
                backgroundColor: ['hsla(180, 100%, 50%, 0.3)', 'hsla(220, 20%, 60%, 0.3)', 'hsla(220, 20%, 60%, 0.3)', 'hsla(220, 20%, 60%, 0.3)', 'hsla(220, 20%, 60%, 0.3)'],
                borderColor: ['hsl(180, 100%, 50%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)', 'hsl(220, 20%, 60%)'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } }
            },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { max: 100, ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });
}

// -------------------------------------------------------------
// SOTA COMPARATIVE RESEARCH CHARTS (STATIC DATA)
// -------------------------------------------------------------
function renderResearchCharts() {
    const accuracyCtx = document.getElementById("researchAccuracyChart");
    const fpsCtx = document.getElementById("researchFPSChart");
    if (!accuracyCtx || !fpsCtx) return;

    const models = ["Faster R-CNN", "EfficientDet", "SSD", "YOLOv5", "YOLOv8"];
    const accuracies = [46.0, 43.1, 34.3, 48.2, 53.9];
    const speeds = [12, 32, 45, 70, 85];

    new Chart(accuracyCtx.getContext("2d"), {
        type: 'bar',
        data: {
            labels: models,
            datasets: [{
                label: 'Model Accuracy (mAP50-95 %)',
                data: accuracies,
                backgroundColor: 'hsla(270, 85%, 65%, 0.5)',
                borderColor: 'hsl(270, 85%, 65%)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } }
            },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { max: 60, ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });

    new Chart(fpsCtx.getContext("2d"), {
        type: 'bar',
        data: {
            labels: models,
            datasets: [{
                label: 'Inference Speed (FPS on V100 GPU)',
                data: speeds,
                backgroundColor: 'hsla(180, 100%, 50%, 0.5)',
                borderColor: 'hsl(180, 100%, 50%)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } }
            },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });
}

// -------------------------------------------------------------
// TELEMETRY TRAINING SYSTEM STREAM PIPELINE
// -------------------------------------------------------------
function startTrainingRun() {
    const btn = document.getElementById("btnStartTraining");
    const term = document.getElementById("trainingTerminal");
    const progressFill = document.getElementById("trainingProgressBar");
    
    btn.disabled = true;
    term.innerHTML = `<div class="terminal-line hud-mono" style="color:var(--text-secondary);">Initializing training telemetry...</div>`;
    progressFill.style.width = "0%";

    const lossData = [];
    const valLossData = [];
    const mapData = [];

    // Chart.js Loss
    const ctxLoss = document.getElementById("lossChart").getContext("2d");
    if (lossChart) lossChart.destroy();
    lossChart = new Chart(ctxLoss, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Train Loss', data: lossData, borderColor: 'hsl(180, 100%, 50%)', tension: 0.1, fill: false },
                { label: 'Val Loss', data: valLossData, borderColor: 'hsl(270, 85%, 65%)', tension: 0.1, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } } },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });

    // Chart.js mAP
    const ctxMap = document.getElementById("mapChart").getContext("2d");
    if (mapChart) mapChart.destroy();
    mapChart = new Chart(ctxMap, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{ label: 'mAP50 Accuracy', data: mapData, borderColor: 'hsl(140, 80%, 48%)', tension: 0.1, fill: false }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: 'hsl(220, 15%, 70%)', font: { family: 'Share Tech Mono' } } } },
            scales: {
                x: { ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } },
                y: { max: 1.0, ticks: { color: 'hsl(220, 10%, 60%)', font: { family: 'Share Tech Mono' } } }
            }
        }
    });

    trainingEventSource = new EventSource('/training_stream');

    trainingEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Append log to terminal
        const div = document.createElement("div");
        div.className = "terminal-line hud-mono";
        div.innerText = ">> " + data.message;
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;

        progressFill.style.width = `${data.progress}%`;

        // Update training graphs
        if (data.epoch > 0 && data.train_loss !== undefined) {
            lossChart.data.labels.push(`Epoch ${data.epoch}`);
            lossChart.data.datasets[0].data.push(data.train_loss);
            lossChart.data.datasets[1].data.push(data.val_loss);
            lossChart.update();

            mapChart.data.labels.push(`Epoch ${data.epoch}`);
            mapChart.data.datasets[0].data.push(data.map50);
            mapChart.update();
        }

        if (data.done) {
            trainingEventSource.close();
            btn.disabled = false;
        }
    };

    trainingEventSource.onerror = (err) => {
        console.error("Training lost connection:", err);
        const div = document.createElement("div");
        div.className = "terminal-line hud-mono";
        div.style.color = "var(--accent-danger)";
        div.innerText = ">> Connection to telemetry stream lost.";
        term.appendChild(div);
        trainingEventSource.close();
        btn.disabled = false;
    };
}

// -------------------------------------------------------------
// DYNAMIC SPECIES ENCYCLOPEDIA RENDER
// -------------------------------------------------------------
let encyclopediaData = [];

function loadEncyclopedia() {
    fetch("/api/encyclopedia")
        .then(res => res.json())
        .then(data => {
            encyclopediaData = data;
            renderEncyclopedia(encyclopediaData);
        })
        .catch(err => {
            console.error("Failed to load dynamic encyclopedia:", err);
            encyclopediaData = [
                { label: "bear", scientific_name: "Ursidae", category: "Mammal", status: "Vulnerable", class: "vu" },
                { label: "elephant", scientific_name: "Loxodonta africana", category: "Mammal", status: "Endangered", class: "en" },
                { label: "zebra", scientific_name: "Equus quagga", category: "Mammal", status: "Near Threatened", class: "vu" },
                { label: "giraffe", scientific_name: "Giraffa camelopardalis", category: "Mammal", status: "Vulnerable", class: "vu" },
                { label: "cow", scientific_name: "Bos taurus", category: "Mammal", status: "Least Concern", class: "lc" },
                { label: "horse", scientific_name: "Equus caballus", category: "Mammal", status: "Least Concern", class: "lc" },
                { label: "sheep", scientific_name: "Ovis aries", category: "Mammal", status: "Least Concern", class: "lc" },
                { label: "dog", scientific_name: "Canis familiaris", category: "Mammal", status: "Least Concern", class: "lc" },
                { label: "cat", scientific_name: "Felis catus", category: "Mammal", status: "Least Concern", class: "lc" },
                { label: "bird", scientific_name: "Aves", category: "Bird", status: "Least Concern", class: "lc" },
            ];
            renderEncyclopedia(encyclopediaData);
        });
}

function renderEncyclopedia(list) {
    const grid = document.getElementById("encyclopediaGrid");
    grid.innerHTML = "";
    
    if (list.length === 0) {
        const query = document.getElementById("encyclopediaSearch").value.trim();
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-glass); border: 1px solid var(--border-glass); border-radius: 8px; animation: fadeIn 0.4s ease;">
                <span class="material-icons-outlined" style="font-size: 3rem; color: var(--accent-purple); margin-bottom: 1rem; display: block;">psychology</span>
                <h3 class="hud-mono" style="margin-bottom: 0.5rem; color: var(--text-primary);">UNIVERSAL SPECIES SYNTHESIS PENDING</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.5rem; line-height: 1.5;">
                    "${query}" is not registered in our local monitoring database index. Would you like our SOTA Synthesizer to dynamically generate an ecological profile on the fly?
                </p>
                <button class="btn-primary glow-purple" onclick="queryChatbotFromCard('${query}')">
                    Synthesize & Query ${query.toUpperCase()} Profile
                </button>
            </div>
        `;
        return;
    }
    
    list.forEach(item => {
        const borderCol = item.class === "en" ? "var(--accent-danger)" : (item.class === "vu" ? "var(--accent-warning)" : "var(--accent-success)");
        const card = document.createElement("div");
        card.className = "card info-card";
        card.style.borderColor = borderCol;
        card.innerHTML = `
            <div class="info-card-title">
                ${item.label.toUpperCase()}
                <span class="info-status ${item.class}">${item.status.toUpperCase()}</span>
            </div>
            <div class="info-detail"><strong>Scientific Name:</strong> <em>${item.scientific_name}</em></div>
            <div class="info-detail"><strong>Species Class:</strong> ${item.category}</div>
            <button class="btn-action" style="margin-top:0.75rem; width:100%;" onclick="queryChatbotFromCard('${item.label}')">Ask EcoBot Details</button>
        `;
        grid.appendChild(card);
    });
}

function filterEncyclopedia() {
    const query = document.getElementById("encyclopediaSearch").value.toLowerCase().trim();
    const filtered = encyclopediaData.filter(item => 
        item.label.toLowerCase().includes(query) || 
        item.scientific_name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
    renderEncyclopedia(filtered);
}

function queryChatbotFromCard(animalLabel) {
    toggleChatPanel(true);
    const input = document.getElementById("chatInput");
    input.value = `Tell me details about ${animalLabel}`;
    sendChatMessage();
}

// -------------------------------------------------------------
// FLOATING AI CHATBOT DRAWER
// -------------------------------------------------------------
function toggleChatPanel(show) {
    const drawer = document.getElementById("chatDrawer");
    const toggle = document.getElementById("chatToggle");
    
    if (show) {
        drawer.classList.add("open");
        toggle.style.opacity = "0";
        toggle.style.pointerEvents = "none";
    } else {
        drawer.classList.remove("open");
        toggle.style.opacity = "1";
        toggle.style.pointerEvents = "all";
    }
}

function quickQueryChat(text) {
    toggleChatPanel(true);
    const input = document.getElementById("chatInput");
    input.value = text;
    sendChatMessage();
}

function handleChatKey(event) {
    if (event.key === "Enter") {
        sendChatMessage();
    }
}

function sendChatMessage() {
    const input = document.getElementById("chatInput");
    const query = input.value.trim();
    if (!query) return;

    appendChatMessage(query, "user");
    input.value = "";

    fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query })
    })
        .then(res => res.json())
        .then(data => {
            appendChatMessage(data.reply, "bot");
            speakBotResponse(data.reply);
        })
        .catch(err => {
            console.error("Chat error:", err);
            appendChatMessage("Connection to eco-agent lost. Please check backend socket.", "bot");
        });
}

function appendChatMessage(text, sender) {
    const msgBox = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = `chat-msg ${sender}`;
    div.innerHTML = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
}

// -------------------------------------------------------------
// WEB SPEECH LIAISON (STT & TTS ENGINE)
// -------------------------------------------------------------
let voiceRecognitionInstance = null;

function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Web Speech API recognition is not supported in this browser. Please use Chrome.");
        return;
    }

    const btn = document.getElementById("btnVoiceInput");
    const status = document.getElementById("voiceStatus");

    if (voiceRecognitionInstance) {
        voiceRecognitionInstance.stop();
        return;
    }

    voiceRecognitionInstance = new SpeechRecognition();
    voiceRecognitionInstance.continuous = false;
    voiceRecognitionInstance.interimResults = false;
    voiceRecognitionInstance.lang = 'en-US';

    voiceRecognitionInstance.onstart = () => {
        if (btn) btn.classList.add("recording");
        if (status) {
            status.innerText = "Listening...";
            status.style.display = "inline";
        }
    };

    voiceRecognitionInstance.onerror = (e) => {
        console.error("Speech recognition error:", e);
        cleanupVoice();
    };

    voiceRecognitionInstance.onend = () => {
        cleanupVoice();
    };

    voiceRecognitionInstance.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const input = document.getElementById("chatInput");
        if (input && text) {
            input.value = text;
            sendChatMessage();
        }
    };

    voiceRecognitionInstance.start();
}

function cleanupVoice() {
    const btn = document.getElementById("btnVoiceInput");
    const status = document.getElementById("voiceStatus");
    if (btn) btn.classList.remove("recording");
    if (status) {
        status.style.display = "none";
    }
    voiceRecognitionInstance = null;
}

function speakBotResponse(htmlText) {
    const toggle = document.getElementById("chatSpeakToggle");
    if (!toggle || !toggle.checked) return;

    if ('speechSynthesis' in window) {
        // Strip HTML tags for clean vocal readouts
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlText;
        let cleanText = tempDiv.textContent || tempDiv.innerText || "";
        
        // Remove excessive spaces or brackets
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        // Limit reading to a concise preview snippet if reply is very long
        if (cleanText.length > 300) {
            cleanText = cleanText.slice(0, 280) + "... dossier summary finished.";
        }
        
        window.speechSynthesis.cancel();
        const speakUtterance = new SpeechSynthesisUtterance(cleanText);
        speakUtterance.rate = 1.0;
        window.speechSynthesis.speak(speakUtterance);
    }
}

// -------------------------------------------------------------
// CYBER ECOLOGICAL PDF RECORD GENERATOR
// -------------------------------------------------------------
function generatePDFReport() {
    window.print();
}
