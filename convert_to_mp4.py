from moviepy import VideoFileClip, ColorClip, CompositeVideoClip

mov_path = '/Users/juanchacon/Desktop/iPhone16_Mockup_Video_Straight.mov'
mp4_path = '/Users/juanchacon/Desktop/iPhone16_Mockup_Video_Straight.mp4'

print(f"Loading {mov_path}...")
video = VideoFileClip(mov_path)

# MP4 (H.264) does not support transparency.
# We must choose a background color.
# Defaulting to Black (standard behavior) but making it explicit helps avoid artifacts.
# User can change this color if they need (e.g. to Green for chroma key).
bg_color = (0, 0, 0) # RGB
print("Creating background clip (Black)...")
bg = ColorClip(size=video.size, color=bg_color, duration=video.duration)

print("Compositing...")
final = CompositeVideoClip([bg, video])

print(f"Writing to {mp4_path}...")
final.write_videofile(mp4_path, fps=24, codec="libx264", audio_codec="aac")
print("Done.")
