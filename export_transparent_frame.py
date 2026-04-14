from psd_tools import PSDImage

psd_path = '/Users/juanchacon/Desktop/Free_Realistic_iPhone_16_Pro_in_Hand_Mockup.psd'
psd = PSDImage.open(psd_path)

# Hide Background layer
for layer in psd:
    if layer.name == 'Background':
        layer.visible = False
    if layer.name == 'Change This':
        layer.visible = False # Hide screen so we get just the frame (Hand + Phone body)

print("Exporting frame with transparent background...")
# composite(force=True) might be needed to ensure alpha if background was opaque.
# But simply composite() should respect transparency if the background layer is off.
frame_img = psd.composite() 
frame_img.save('debug_frame_transparent.png')
print("Done.")
