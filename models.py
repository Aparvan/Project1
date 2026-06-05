from database import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), default="Guest") # Ranger, Administrator, Guest

class DetectionSession(db.Model):
    __tablename__ = 'detection_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    image_path = db.Column(db.String(512), nullable=False)
    inference_time_ms = db.Column(db.Float, nullable=False)
    model_name = db.Column(db.String(50), default="yolov8n")
    camera_id = db.Column(db.String(50), default="Cam-01")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    objects = db.relationship('DetectedObject', backref='session', cascade='all, delete-orphan')

class DetectedObject(db.Model):
    __tablename__ = 'detected_objects'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('detection_sessions.id'), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    
    # Bounding box coordinates normalized relative to image width/height (0.0 to 1.0)
    x_min = db.Column(db.Float, nullable=False)
    y_min = db.Column(db.Float, nullable=False)
    x_max = db.Column(db.Float, nullable=False)
    y_max = db.Column(db.Float, nullable=False)

    # Hackathon intelligence & tracking extensions
    tracking_id = db.Column(db.Integer, nullable=True)
    predicted_age = db.Column(db.String(50), nullable=True)
    health_status = db.Column(db.String(50), nullable=True)
    velocity_heading = db.Column(db.String(50), nullable=True)

class DangerAlert(db.Model):
    __tablename__ = 'danger_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('detection_sessions.id', ondelete='SET NULL'), nullable=True)
    label = db.Column(db.String(100), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
