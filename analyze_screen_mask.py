import cv2
import numpy as np

img_path = 'debug_screen_only.png'
img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)

# Extract alpha channel
if img.shape[2] == 4:
    alpha = img[:, :, 3]
else:
    # If no alpha, assume black background?
    # But psd export should have alpha if layer was isolated.
    # Let's check.
    print("No alpha channel found, assuming thresholding on color.")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)

# Find contours
contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
if not contours:
    print("No contours found")
    exit()

# Assume the largest contour is the screen
cnt = max(contours, key=cv2.contourArea)

# Aproximar un poligono (rectangulo o cuadrilatero)
epsilon = 0.02 * cv2.arcLength(cnt, True)
approx = cv2.approxPolyDP(cnt, epsilon, True)

# We expect 4 points for the screen
print(f"Approximated points: {len(approx)}")
for p in approx:
    print(f"Point: {p[0]}")

# If we have 4 points, sort them to TL, TR, BR, BL order
if len(approx) == 4:
    pts = approx.reshape(4, 2)
    # Simple sort might not work for rotated, but let's see coordinates first.
    print(f"Corner Coordinates: {pts.tolist()}")
else:
    print("Could not approximate to 4 points. Using bounding box logic.")
    x,y,w,h = cv2.boundingRect(cnt)
    print(f"Bounding Rect: {(x,y,w,h)}")
