import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-12938120938')
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'detect_database.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32MB max-limit
    
    # Dangerous animals list (based on COCO dataset classes)
    DANGEROUS_ANIMALS = {
        'bear', 'elephant', 'zebra', 'giraffe', 'cow', 'horse', 'sheep', # Let's classify large wild/farm animals that can trigger alarms, or keep it to predators
        'bear', 'elephant', 'tiger', 'lion', 'crocodile', 'snake', 'leopard', 'wolf' 
    }
    
    # Standard animals list for general interest
    INTERESTING_ANIMALS = {
        'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'
    }
