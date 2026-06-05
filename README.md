# AI Smart Wildlife Monitoring & Proximity Scanning Platform

A state-of-the-art Web & AI interface for wildlife sanctuaries, featuring real-time edge computer vision, dynamic georeferenced satellite tracking, automated predator warning sirens, and a conversational Claude-powered EcoIntelligence liaison.

---

## 🌟 Key Features

1. **Real-time Proximity Scanning (WebRTC Webcam)**
   - Streams browser-side webcam video via standard HTML5 media devices.
   - Run inferences on frames at 400ms intervals using YOLOv8 edge models.
   - Interactive SVG Bounding Box Overlays that reveal glassmorphic ecological details (scientific name, category, health index, tracking ID) on mouse hover.
   - Faint CRT scanline grid and vertical laser sweep radar overlays on active feeds.

2. **Universal 220+ Species Bounding Box Detection**
   - Expanded dictionary supporting 220+ animals (e.g. Red Panda, Sloth, Python, Komodo Dragon).
   - Backend parsing handles multi-word species matching first to avoid coordinates overlaps.
   - On-the-fly biological dossier synthesizer for unregistered species.

3. **Persistent SQLite Telemetry Database Logs**
   - Telemetry database logs webcam snapshots to `static/uploads/`.
   - Saves structured records mapping to georeferenced `DetectionSession` and `DetectedObject` SQLite entries.
   - Allows operator inspect, audit, and clean log functions.

4. **Claude-Style Chatbot Voice Liaison (EcoBot)**
   - Float-drawer interactive liaison running custom taxonomy and database audits.
   - Speech-to-Text: Dictate messages using Chrome's Web Speech API.
   - Text-to-Speech: Vocalize chat responses with an integrated HTML parser that strips markup tags for clean speech readout.

5. **Sanctuary Satellite Map & Global Nodes**
   - Renders high-resolution Google Hybrid Satellite maps using Leaflet.js.
   - Displays 8 camera nodes georeferenced globally (Serengeti, Corbett Tiger Reserve, Amazon Flooded Canopy, Yellowstone Grizzly Trail, Kangaroo Island, Svalbard Glacial Outpost).
   - Sidebar camera selections fly and zoom the camera map directly to the reserve coordinate system in real-time.

6. **Interactive Deep Learning Benchmarks**
   - Runs model comparison scripts comparing YOLOv8 (Nano, Small, Medium) against older architectures (YOLOv5, SSD, Faster R-CNN, EfficientDet).
   - Renders dynamic Chart.js stats comparing inference speed, memory footprint, and mean Average Precision (mAP).

---

## 📂 Project Directory Structure

```
├── app.py                     # Main Flask Server & API routes
├── config.py                  # Core configuration flags and parameters
├── database.py                # SQLAlchemey DB initialization wrapper
├── models.py                  # SQLite DB models (User, Sessions, Detections, Alerts)
├── yolov8_analyzer.py         # YOLOv8 helper & filename overrides
├── animal_intelligence.py     # Species encyclopedia and biological dossiers
├── model_comparer.py          # Benchmark comparative wrapper
├── requirements.txt           # Python dependencies manifest
├── .gitignore                 # GitHub ignore rules (Venv, weight weights, DB)
├── Dockerfile                 # Container packaging docker configuration
├── docker-compose.yml         # Multi-service setup orchestration
├── templates/
│   └── index.html             # Main dashboard UI HTML
└── static/
    ├── css/
    │   └── style.css          # Core platform stylesheets
    ├── js/
    │   └── main.js            # Frontend JavaScript interface
    ├── uploads/               # Holds webcam snaps & uploaded sightings (.gitkeep)
    └── videos/                # Background loops for feed simulation (.gitkeep)
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8 or higher
- Modern web browser (Google Chrome recommended for Web Speech recognition features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd ai-image-research
   ```

2. **Set up a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Open in browser:**
   Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/) in your web browser.

---

## 🐳 Docker Deployment

To spin up the platform inside a containerized setup:

1. **Build and start the container:**
   ```bash
   docker-compose up --build
   ```
2. **Access the application at:** `http://127.0.0.1:5000/`

---

## ⚙️ Model Weights
The platform uses the **YOLOv8** model family. On the first startup, Ultralytics will automatically download the required pretrained weights (`yolov8n.pt`, `yolov8s.pt`, `yolov8m.pt`) to your project root folder. These weight files are ignored in `.gitignore` to avoid pushing large binary files to GitHub.
