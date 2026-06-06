import cv2
import numpy as np

class AnimalDistressAnalyzer:
    def __init__(self):
        self.previous_center = None
        self.low_movement_frames = 0
        self.tracking_states = {} # {track_id: {"previous_center": (cx, cy), "low_movement_frames": int}}

    def analyze(self, box, track_id=None):
        """
        box = [x1, y1, x2, y2]
        """
        x1, y1, x2, y2 = box

        center_x = int((x1 + x2) / 2)
        center_y = int((y1 + y2) / 2)

        distress_score = 0
        reasons = []

        # Fetch tracking state if track_id is provided
        if track_id is not None:
            if track_id not in self.tracking_states:
                self.tracking_states[track_id] = {
                    "previous_center": None,
                    "low_movement_frames": 0
                }
            state = self.tracking_states[track_id]
        else:
            state = {
                "previous_center": self.previous_center,
                "low_movement_frames": self.low_movement_frames
            }

        prev_center = state["previous_center"]
        low_frames = state["low_movement_frames"]

        if prev_center is not None:
            movement = np.linalg.norm(
                np.array([center_x, center_y]) -
                np.array(prev_center)
            )

            # Low movement detection
            if movement < 8:
                low_frames += 1
            else:
                low_frames = 0

            # Possible distress
            if low_frames > 20:
                distress_score += 40
                reasons.append("Very low movement detected")

            # Sudden unstable movement
            if movement > 120:
                distress_score += 25
                reasons.append("Sudden unstable movement")

        # Abnormal posture heuristic
        width = x2 - x1
        height = y2 - y1

        if width > height * 1.8:
            distress_score += 20
            reasons.append("Possible abnormal lying posture")

        # Update state
        state["previous_center"] = (center_x, center_y)
        state["low_movement_frames"] = low_frames

        if track_id is not None:
            self.tracking_states[track_id] = state
        else:
            self.previous_center = state["previous_center"]
            self.low_movement_frames = state["low_movement_frames"]

        # Risk levels
        if distress_score >= 60:
            status = "HIGH DISTRESS"
        elif distress_score >= 30:
            status = "MEDIUM DISTRESS"
        else:
            status = "NORMAL"

        return {
            "distress_score": distress_score,
            "status": status,
            "reasons": reasons
        }
