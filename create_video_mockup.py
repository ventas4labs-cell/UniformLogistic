import cv2
import numpy as np
from moviepy import VideoFileClip, ImageClip, CompositeVideoClip, VideoClip

# Paths
bg_path = 'debug_frame_no_screen.png'
mask_path = 'debug_screen_only.png'
video_path = '/Users/juanchacon/Desktop/ScreenRecording_01-21-2026 23-08-15_1.MP4'
output_path = '/Users/juanchacon/Desktop/iPhone16_Mockup_Video.mp4'

# Offsets from PSD inspection
OFFSET_X = 2193
OFFSET_Y = 607

# 1. Get Global Corners
print("Analyzing mask for corners...")
mask_img = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
# Alpha extraction
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
    print("Error: Could not find 4 corners. Using BBox.")
    x,y,w,h = cv2.boundingRect(cnt)
    # create corners from bbox
    pts = np.array([
        [x, y],
        [x+w, y],
        [x+w, y+h],
        [x, y+h]
    ])
else:
    pts = approx.reshape(4, 2)

# Sort corners: Top-Left, Top-Right, Bottom-Right, Bottom-Left
# Sort by Y first (Top vs Bottom)
pts = pts[np.argsort(pts[:, 1])]
top = pts[:2]
bottom = pts[2:]
# Sort Top by X (Left vs Right)
top = top[np.argsort(top[:, 0])]
# Sort Bottom by X (Left vs Right) ---> typically Mask BR is right-most
bottom = bottom[np.argsort(bottom[:, 0])]
# Order: TL, TR, BL, BR
# But standard perspective wrap usually expects TL, TR, BR, BL order or consistent with input.
# Let's use TL, TR, BR, BL
# top[0] is TL, top[1] is TR
# bottom[0] is BL, bottom[1] is BR
dest_corners = np.array([
    top[0],     # TL
    top[1],     # TR
    bottom[1],  # BR
    bottom[0]   # BL
], dtype="float32")

# Add offset
dest_corners[:, 0] += OFFSET_X
dest_corners[:, 1] += OFFSET_Y

print(f"Global Corners: \n{dest_corners}")

# 2. Setup Video Processing
print("Loading media...")
video = VideoFileClip(video_path)
bg_clip = ImageClip(bg_path).with_duration(video.duration)
# bg_clip is assumed to be 6000x4500 if img is that size.

# Create Full Canvas Mask
# We need an ImageClip for the mask that is full size.
# Create a black canvas 6000x4500 and paste the mask at offset.
# We can do this with composite or numpy.
full_mask_canvas = np.zeros((4500, 6000), dtype=np.uint8) # H, W
# mask_img alpha is the mask.
h_m, w_m = alpha.shape
full_mask_canvas[OFFSET_Y:OFFSET_Y+h_m, OFFSET_X:OFFSET_X+w_m] = alpha
# Convert to float 0-1
full_mask_norm = full_mask_canvas.astype(float) / 255.0

# Create Mask Clip
mask_clip = ImageClip(full_mask_norm, is_mask=True).with_duration(video.duration)

# 3. Warp Function
w_vid, h_vid = video.size
src_corners = np.array([
    [0, 0],
    [w_vid, 0],
    [w_vid, h_vid],
    [0, h_vid]
], dtype="float32")

matrix = cv2.getPerspectiveTransform(src_corners, dest_corners)

def warp_frame(get_frame, t):
    frame = get_frame(t) # returns numpy array (H, W, 3)
    # Warp to full 6000x4500 canvas
    warped = cv2.warpPerspective(frame, matrix, (6000, 4500))
    return warped

# Create the warped video clip
print("Creating warped video clip...")
# VideoClip takes a make_frame function. make_frame(t)
warped_clip = VideoClip(lambda t: warp_frame(video.get_frame, t), duration=video.duration)

# Set the mask
warped_clip = warped_clip.with_mask(mask_clip)

# 4. Composite
print("Compositing...")
final = CompositeVideoClip([bg_clip, warped_clip], size=(6000, 4500))

# 5. Write
# We might want to resize for speed/file size unless 6K is required.
# Let's resize output to 1/3 size (2000px wide) to make it manageable?
# Or ask user? User didn't specify. I'll provide full or high res.
# 6000x4500 is huge for video. 4K is 3840. 
# Let's resize final to width=1920 (Standard HD) for the preview/output.
final_resized = final.resized(width=1920)

print(f"Writing to {output_path}...")
final_resized.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
print("Done.")
