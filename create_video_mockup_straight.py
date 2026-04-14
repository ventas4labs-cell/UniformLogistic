import cv2
import numpy as np
from moviepy import VideoFileClip, ImageClip, CompositeVideoClip, VideoClip
import math

# Paths
bg_path = 'debug_frame_transparent.png' # This has alpha now
mask_path = 'debug_screen_only.png'
video_path = '/Users/juanchacon/Desktop/ScreenRecording_01-21-2026 23-08-15_1.MP4'
output_path = '/Users/juanchacon/Desktop/iPhone16_Mockup_Video_Straight.mov' # MOV for simple alpha support with png codec

OFFSET_X = 2193
OFFSET_Y = 607

# 1. Get Global Corners (Same as before)
print("Analyzing mask for corners...")
mask_img = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
if mask_img.shape[2] == 4:
    alpha = mask_img[:, :, 3]
else:
    gray = cv2.cvtColor(mask_img, cv2.COLOR_BGR2GRAY)
    _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)

contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnt = max(contours, key=cv2.contourArea)
epsilon = 0.02 * cv2.arcLength(cnt, True)
approx = cv2.approxPolyDP(cnt, epsilon, True)

if len(approx) != 4:
    x,y,w,h = cv2.boundingRect(cnt)
    pts = np.array([[x, y],[x+w, y],[x+w, y+h],[x, y+h]])
else:
    pts = approx.reshape(4, 2)

pts = pts[np.argsort(pts[:, 1])] # Sort by Y
top = pts[:2]
bottom = pts[2:]
top = top[np.argsort(top[:, 0])] # TL, TR
bottom = bottom[np.argsort(bottom[:, 0])] # BL, BR

dest_corners_local = np.array([top[0], top[1], bottom[1], bottom[0]], dtype="float32")
dest_corners = dest_corners_local.copy()
dest_corners[:, 0] += OFFSET_X
dest_corners[:, 1] += OFFSET_Y

# Calculate Rotation Angle to Straighten
# Use top edge
tl = dest_corners[0]
tr = dest_corners[1]
dx = tr[0] - tl[0]
dy = tr[1] - tl[1]
angle_rad = math.atan2(dy, dx)
angle_deg = math.degrees(angle_rad)
# If dy is negative (TR higher than TL), angle is negative.
# To make it horizontal (0 degrees), we need to rotate by -angle.
# Example: -5 deg. Rotate by +5 deg.
rotate_angle = -angle_deg
print(f"Detected tilt: {angle_deg:.2f} degrees. Rotating by {rotate_angle:.2f} degrees.")

# 2. Setup Video
video = VideoFileClip(video_path)
bg_clip = ImageClip(bg_path, transparent=True).with_duration(video.duration)

# 3. Create Mask Clip (Global)
full_mask_canvas = np.zeros((4500, 6000), dtype=np.uint8)
h_m, w_m = alpha.shape
full_mask_canvas[OFFSET_Y:OFFSET_Y+h_m, OFFSET_X:OFFSET_X+w_m] = alpha
full_mask_norm = full_mask_canvas.astype(float) / 255.0
mask_clip = ImageClip(full_mask_norm, is_mask=True).with_duration(video.duration)

# 4. Warp Video
w_vid, h_vid = video.size
src_corners = np.array([[0, 0], [w_vid, 0], [w_vid, h_vid], [0, h_vid]], dtype="float32")
matrix = cv2.getPerspectiveTransform(src_corners, dest_corners)

def warp_frame(get_frame, t):
    frame = get_frame(t)
    warped = cv2.warpPerspective(frame, matrix, (6000, 4500))
    # warpPerspective fills border with black by default, but we have a mask so it's fine.
    # We need to ensure the output has alpha if we want to rotate it properly later? 
    # Actually, the clip itself is opaque RGB, but 'mask_clip' gives it alpha.
    return warped

warped_clip = VideoClip(lambda t: warp_frame(video.get_frame, t), duration=video.duration)
warped_clip = warped_clip.with_mask(mask_clip)

# 5. Composite
print("Compositing...")
# We composite the warped video ON TOP of the background (Hand+Frame).
final = CompositeVideoClip([bg_clip, warped_clip], size=(6000, 4500))

# 6. Rotate
print("Rotating...")
# We rotate the result. This will expand the clip potentially, or we need to manage size.
# MoviePy rotate expands by default.
final_rotated = final.rotated(rotate_angle, expand=True)

# 7. Resize (Optional, but 6K rotated is huge)
# Let's resize height to 1920 (vertical video) or width?
# User wants "Just the phone" maybe?
# Let's keep it relatively high res but safe. Width 1080?
# The phone is vertical now.
final_rotated = final_rotated.resized(width=1080) 

print(f"Writing to {output_path}...")
# codec='png' writes MOV with alpha.
final_rotated.write_videofile(output_path, fps=24, codec="png", audio_codec="aac")
print("Done.")
